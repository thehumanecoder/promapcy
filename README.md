# ProMapcy

ProMapcy is an interactive mind mapping platform that ingests public Git repositories from GitHub, GitLab, or Bitbucket, analyses their structure down to variables and constants, and renders an explorable mind map of the codebase. The project combines a Next.js + React frontend with a Rust-powered WebAssembly analysis engine and Tailwind CSS driven UI components.

## Getting Started

1. Run the development bootstrap script:
   ```bash
   ./scripts/dev-init.sh
   ```
2. Start the Next.js development server:
   ```bash
   pnpm dev
   ```

## Project Structure

- `src/` — Next.js application code (App Router).
- `wasm/` — Rust crate compiled to WebAssembly via `wasm-pack`.
- `docs/` — Architecture and specification documents.
- `scripts/` — Tooling and developer convenience scripts.
- `__tests__/` — Jest + Testing Library test suites.

## Contributing

Please follow the linting and formatting rules (ESLint + Prettier) and keep documentation aligned with implementation updates. Tests should accompany feature work whenever feasible.

## License

MIT
