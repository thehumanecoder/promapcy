#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/dev-init.log"
EXCEPTION_FILE="$LOG_DIR/exceptions.log"
mkdir -p "$LOG_DIR"
touch "$LOG_FILE" "$EXCEPTION_FILE"

log_info() {
  local message="[INFO] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
  echo "$message" | tee -a "$LOG_FILE"
}

log_error() {
  local message="[ERROR] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"
  echo "$message" | tee -a "$LOG_FILE"
  echo "$message" >> "$EXCEPTION_FILE"
}

prompt_yes_no() {
  local prompt="$1"
  while true; do
    read -r -p "$prompt [y/n]: " response
    case "${response,,}" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

run_and_log() {
  local description="$1"
  shift
  log_info "$description"
  set +e
  "$@" 2>&1 | tee -a "$LOG_FILE"
  local status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -eq 0 ]; then
    log_info "Completed: $description"
    return 0
  else
    log_error "Failed ($status): $description"
    return $status
  fi
}

ensure_command() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '$cmd' not found. ${install_hint}"
    return 1
  fi
}

setup_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  if command -v corepack >/dev/null 2>&1; then
    run_and_log "Enabling pnpm via corepack" corepack enable || true
    run_and_log "Activating latest pnpm" corepack prepare pnpm@latest --activate || true
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log_error "pnpm is required. Install via 'corepack enable' or https://pnpm.io/installation"
    return 1
  fi
}

install_dependencies() {
  ensure_command node "Install Node.js >= 18" || return 1
  ensure_command cargo "Install Rust from https://rustup.rs" || return 1
  setup_pnpm || return 1

  if ! command -v wasm-pack >/dev/null 2>&1; then
    log_info "wasm-pack not found."
    if prompt_yes_no "Install wasm-pack using 'cargo install wasm-pack'?"; then
      run_and_log "Installing wasm-pack" cargo install wasm-pack || return 1
    else
      log_info "Skipping wasm-pack installation. Some features may be unavailable."
    fi
  fi

  run_and_log "Installing JavaScript dependencies with pnpm" pnpm install || return 1

  if command -v wasm-pack >/dev/null 2>&1; then
    run_and_log "Building Rust WASM package" wasm-pack build --target web wasm || return 1
  else
    log_info "wasm-pack still unavailable; skipping WASM build."
  fi
}

start_dev_server() {
  setup_pnpm || return 1
  log_info "Starting dev server (press Ctrl+C to stop). Output is logged to $LOG_FILE"
  set +e
  pnpm dev 2>&1 | tee -a "$LOG_FILE"
  local status=${PIPESTATUS[0]}
  set -e
  if [ "$status" -eq 0 ]; then
    log_info "Dev server stopped cleanly."
  elif [ "$status" -eq 130 ]; then
    log_info "Dev server interrupted by user."
  else
    log_error "Dev server exited with status $status"
  fi
}

create_production_build() {
  setup_pnpm || return 1
  run_and_log "Creating production build" pnpm build
}

run_tests() {
  setup_pnpm || return 1
  run_and_log "Running test suite" pnpm test
}

check_logs() {
  if [ ! -s "$LOG_FILE" ]; then
    log_info "Log file is empty. Run some commands first."
    return 0
  fi
  log_info "Showing last 200 lines from $LOG_FILE"
  tail -n 200 "$LOG_FILE"
}

check_exceptions() {
  if [ ! -s "$EXCEPTION_FILE" ]; then
    log_info "No exceptions captured."
    return 0
  fi
  log_info "Showing last 100 lines from $EXCEPTION_FILE"
  tail -n 100 "$EXCEPTION_FILE"
}

run_linting() {
  setup_pnpm || return 1
  run_and_log "Running lint checks" pnpm lint
}

ensure_git_repository() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  log_info "No git repository detected in $ROOT_DIR."
  if ! prompt_yes_no "Initialise a new git repository here?"; then
    log_error "Git operations aborted."
    return 1
  fi

  run_and_log "Initialising git repository" git init || return 1

  if git rev-parse --verify main >/dev/null 2>&1; then
    run_and_log "Switching to main branch" git checkout main || return 1
  else
    run_and_log "Creating main branch" git checkout -b main || return 1
  fi

  if prompt_yes_no "Configure a remote named 'origin'?"; then
    read -r -p "Enter remote URL: " remote_url
    if [ -n "$remote_url" ]; then
      run_and_log "Adding origin remote" git remote add origin "$remote_url" || return 1
    else
      log_error "Remote URL empty; skipping remote configuration."
    fi
  fi
}

commit_and_push() {
  ensure_git_repository || return 1

  if git rev-parse --verify main >/dev/null 2>&1; then
    run_and_log "Checking out main branch" git checkout main || return 1
  else
    run_and_log "Creating main branch" git checkout -b main || return 1
  fi

  run_and_log "Staging changes" git add -A || return 1

  if git diff --cached --quiet; then
    log_info "No staged changes to commit."
  else
    read -r -p "Enter commit message: " commit_message
    commit_message=${commit_message:-"chore: update project"}
    set +e
    git commit -m "$commit_message" 2>&1 | tee -a "$LOG_FILE"
    local status=${PIPESTATUS[0]}
    set -e
    if [ "$status" -eq 0 ]; then
      log_info "Created commit with message: $commit_message"
    else
      log_error "git commit failed with status $status"
      return $status
    fi
  fi

  if ! git remote get-url origin >/dev/null 2>&1; then
    if prompt_yes_no "Remote 'origin' not configured. Add it now?"; then
      read -r -p "Enter remote URL: " remote_url
      if [ -n "$remote_url" ]; then
        run_and_log "Adding origin remote" git remote add origin "$remote_url" || return 1
      else
        log_error "Remote URL empty; add remote manually before pushing."
        return 1
      fi
    else
      log_error "Cannot push without a remote."
      return 1
    fi
  fi

  run_and_log "Pushing to origin/main" git push -u origin main
}

configure_gitignore() {
  local gitignore="$ROOT_DIR/.gitignore"
  if [ ! -f "$gitignore" ]; then
    log_info "Creating .gitignore"
    touch "$gitignore"
  fi

  local entries=(
    "logs/"
    "logs/*.log"
    "*.log"
  )

  local added=0
  for entry in "${entries[@]}"; do
    if ! grep -Fxq "$entry" "$gitignore"; then
      echo "$entry" >> "$gitignore"
      log_info "Added '$entry' to .gitignore"
      ((added++))
    fi
  done

  if [ "$added" -eq 0 ]; then
    log_info "No new entries were added to .gitignore"
  fi
}

show_menu() {
  cat <<'MENU'

ProMapcy Development Toolkit
============================
1) Install dependencies
2) Start development server
3) Create production build
4) Run tests
5) Check logs
6) Check exceptions
7) Run linting
8) Commit and push to git
9) Configure .gitignore
10) Clear the screen
0) Exit
MENU
}

clear_screen() {
  if command -v clear >/dev/null 2>&1; then
    clear
  else
    printf '\033c'
  fi
  log_info "Screen cleared."
}

main() {
  while true; do
    show_menu
    read -r -p "Select an option: " choice
    case "$choice" in
      1) install_dependencies ;;
      2) start_dev_server ;;
      3) create_production_build ;;
      4) run_tests ;;
      5) check_logs ;;
      6) check_exceptions ;;
      7) run_linting ;;
      8) commit_and_push ;;
      9) configure_gitignore ;;
      10) clear_screen ;;
      0) log_info "Goodbye."; exit 0 ;;
      *) echo "Invalid option. Please choose 0-10." ;;
    esac
  done
}

main
