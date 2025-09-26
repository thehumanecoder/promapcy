# Development Guide

## Prerequisites
- Node.js >= 18.17
- npm >= 9
- Rust toolchain (stable)
- wasm-pack (`cargo install wasm-pack`)

## Bootstrapping
Run the convenience script to set up the project:
```bash
./scripts/dev-init.sh
```
This installs Node dependencies, builds the Rust WebAssembly package (if `wasm-pack` is available), and runs linting/tests/type-checks.

## Useful Commands
- `pnpm dev` — Start the Next.js development server.
- `pnpm build` — Create a production build.
- `pnpm lint` — Run ESLint.
- `pnpm test` — Execute Jest unit tests.
- `pnpm type-check` — Invoke the TypeScript compiler.
- `pnpm format:write` — Apply Prettier formatting.

## WASM Workflow
1. Implement Rust analysis logic in `wasm/src/lib.rs`.
2. Build the package via `wasm-pack build --target web wasm`.
3. Next.js can import the generated bindings from `wasm/pkg/`.

## Testing Strategy
- React components: Jest + Testing Library in `__tests__/`.
- WASM crate: Rust unit tests under `wasm/src/` (add `#[cfg(test)]` modules as needed).
- Future: Integration tests with Playwright for interactive mind map behaviours.
