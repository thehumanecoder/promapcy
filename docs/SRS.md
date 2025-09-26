# Software Requirements Specification (SRS) — ProMapcy

## 1. Introduction

### 1.1 Purpose
This document defines the functional and non-functional requirements for ProMapcy, an interactive mind mapping platform that ingests public Git repositories and visualises their structure down to variables, constants, functions, classes, and other language constructs.

### 1.2 Scope
ProMapcy targets software engineers, architects, and educators who need a rapid, visual understanding of unfamiliar codebases. The system supports repositories hosted on GitHub, GitLab, and Bitbucket.

### 1.3 Definitions, Acronyms, Abbreviations
- **AST** — Abstract Syntax Tree.
- **WASM** — WebAssembly.
- **Tailwind CSS** — UI component library used for styling.
- **Node Graph** — Data structure representing code entities and relationships.

### 1.4 References
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [wasm-pack](https://rustwasm.github.io/docs/wasm-pack/)

## 2. Overall Description

### 2.1 Product Perspective
The system consists of:
- A Next.js frontend for repository intake, mind map rendering, and user interaction.
- A Rust WebAssembly module for static analysis and AST traversal.
- A metadata service layer that orchestrates repository fetching, caching, and transformation into a node graph.

### 2.2 Product Functions
- Accept public repository URLs from GitHub, GitLab, and Bitbucket.
- Fetch repository metadata and relevant code files.
- Parse source files to produce an AST enriched with symbol metadata.
- Convert the AST into a hierarchical mind map with nodes for modules, classes, functions, variables, and constants.
- Provide an interactive UI that supports zooming, panning, filtering, and drill-down interactions.

### 2.3 User Classes and Characteristics
- **Developers** — Need deep understanding of an unfamiliar repository.
- **Engineering Managers** — Require architectural overviews.
- **Educators/Students** — Use the mind map to visualise language constructs.

### 2.4 Operating Environment
- Frontend: Modern browsers supporting WebAssembly (Chrome, Firefox, Safari, Edge).
- Backend: Serverless or Node.js runtime for repo ingestion (future scope).
- Supported platforms: macOS, Linux, Windows for local development.

### 2.5 Design and Implementation Constraints
- Must use Next.js with React and Tailwind CSS for the UI layer.
- Static analysis implemented in Rust, compiled to WebAssembly.
- Compliance with platform rate limits for repository hosting providers.
- Offline support is out of scope for the initial release.

### 2.6 Assumptions and Dependencies
- Repositories are publicly accessible without authentication.
- wasm-pack and Rust toolchain are installed for building the WASM module.
- Node.js >= 18 is available for Next.js runtime.

## 3. Specific Requirements

### 3.1 Functional Requirements
1. **Repository Intake**
   - Users provide a repository URL.
   - System validates the host (GitHub, GitLab, Bitbucket) and parses owner/name.
2. **Metadata Retrieval**
   - Fetch default branch metadata (commit hash, branches, tags).
   - Retrieve file tree and raw file contents.
3. **Static Analysis**
   - Parse source files using language-specific parsers compiled to WASM.
   - Extract symbols (variables, constants, functions, classes, interfaces, enums).
   - Build relationships (definitions, invocations, inheritance, references).
4. **Mind Map Generation**
   - Map AST nodes to graph nodes with metadata (type, location, docs).
   - Persist graph in a client-side state store for fast rendering.
   - Support filtering by symbol type and file path.
5. **Interactive Visualisation**
   - Render nodes with Tailwind CSS theming.
   - Support zoom, pan, search, expand/collapse.
   - Display detail panel for selected nodes.
6. **Error Handling**
   - Gracefully handle rate limits and unsupported languages.
   - Surface actionable error messages with retriable actions.

### 3.2 Non-Functional Requirements
- **Performance**: Initial graph render under 3 seconds for repos <= 1,000 files.
- **Scalability**: Handle repos up to 10,000 files with progressive loading.
- **Reliability**: Maintain consistent state even if analysis partially fails.
- **Usability**: Follow Tailwind CSS accessibility guidelines (WCAG AA).
- **Security**: Avoid executing untrusted code; treat repo data as read-only.
- **Maintainability**: Enforce ESLint + Prettier; modular Rust crate.

### 3.3 External Interface Requirements
- **User Interface**: Tailwind CSS styled layout with responsive design.
- **APIs**: HTTP requests to Git hosting services; future serverless backend.
- **Hardware Interface**: None.

### 3.4 Traceability Matrix
| Requirement ID | Description | Implementation Artifact |
| -------------- | ----------- | ------------------------ |
| FR-1           | Repository Intake | `src/app/page.tsx`, `src/components/RepoFetcher.tsx` |
| FR-2           | Metadata Retrieval | `src/lib/repo-fetcher.ts` |
| FR-3           | Static Analysis | `wasm/src/lib.rs`, `src/lib/wasm/index.ts` |
| FR-4           | Mind Map Generation | `src/components/MindMapCanvas.tsx` |
| FR-5           | Interactive Visualisation | `src/components/MindMapCanvas.tsx`, `src/app/page.tsx` |
| FR-6           | Error Handling | `src/components/RepoFetcher.tsx`, `src/app/page.tsx` |
| NFR-Perf       | Performance | Performance budget tests (future) |
| NFR-Usability  | Accessibility | Tailwind CSS components |

## 4. Appendices
- **A**: Future enhancements (collaborative editing, private repos via OAuth, server-side caching).
- **B**: Testing strategy outline (unit tests in Jest, integration tests via Playwright, Rust unit tests).
