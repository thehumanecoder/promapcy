# Architecture Overview

## High-Level Components

- **Next.js Frontend (`src/`)**
  - Handles routing, data fetching, and UI rendering.
  - Uses Tailwind CSS for layout, theming, and interactive controls.
  - Integrates with the WebAssembly analysis engine through a thin TypeScript wrapper.

- **Rust WASM Crate (`wasm/`)**
  - Performs heavy static analysis work: parsing source files and emitting a normalised graph of code entities.
  - Compiled to WebAssembly via `wasm-pack` for browser interoperability.

- **Client State Management**
  - Mind map data stored in React context + Zustand store (placeholder for now) to keep the UI responsive.
  - Supports caching of repository analysis results in IndexedDB (future enhancement).

## Data Flow

1. The user provides a repository URL via the `RepoFetcher` component.
2. The frontend validates the host and requests metadata through `fetchRepositoryMetadata` in `src/lib/repo-fetcher.ts`.
3. Raw file contents are passed into the WASM module (`wasm_graph_from_repo`) using the bindings in `src/lib/wasm/index.ts`.
4. The WASM module emits a `MindMapGraph` JSON payload containing nodes (modules, classes, functions, variables, constants) and edges (references, containment, inheritance).
5. The `MindMapCanvas` component renders the graph using a canvas/WebGL powered renderer (placeholder for now) styled with Tailwind utility classes.

## Deployment Targets

- **Development**: `pnpm dev` launches Next.js with the WASM module served locally.
- **Production**: `pnpm build` generates the static Next.js build; Rust WASM is packaged under `public/wasm/` for CDN delivery.

## Technology Decisions

- **Next.js App Router**: Enables server components and co-located data fetching where appropriate, while supporting SPA-like interactivity.
- **Tailwind CSS**: Provides a composable utility system to build a modern, responsive UI without heavyweight component dependencies.
- **Rust + WebAssembly**: Supplies the performance necessary for parsing large repositories directly in the browser or a Node worker.
- **TypeScript**: Ensures type safety across the frontend codebase and WASM bindings.

## Open Questions

- Which languages should the Rust parser support initially? (Default: JavaScript/TypeScript using `tree-sitter` bindings.)
- Should repository fetching occur entirely client-side, or via a serverless proxy to handle rate limits?
- How should large repositories be chunked to avoid blocking the UI?
