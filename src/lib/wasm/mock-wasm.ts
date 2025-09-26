import type { AnalysisResult, MindMapGraph } from '@/lib/schema';

type MockGraphBuilderOptions = {
  repositoryUrl: string;
};

function buildMockGraph({ repositoryUrl }: MockGraphBuilderOptions): AnalysisResult {
  const graph: MindMapGraph = {
    repositoryUrl,
    nodes: [
      { id: 'repo', label: repositoryUrl, type: 'repository', parentId: null },
      { id: 'file:README.md', label: 'README.md', type: 'file', parentId: 'repo' },
      { id: 'fn:init', label: 'init', type: 'function', parentId: 'file:README.md' },
      { id: 'const:VERSION', label: 'VERSION', type: 'constant', parentId: 'file:README.md' },
    ],
    edges: [
      { from: 'repo', to: 'file:README.md', relationship: 'contains' },
      { from: 'file:README.md', to: 'fn:init', relationship: 'contains' },
      { from: 'file:README.md', to: 'const:VERSION', relationship: 'contains' },
    ],
  };

  return {
    graph,
    warnings: ['Using mock WASM graph; build the Rust crate for real analysis.'],
  };
}

export function wasm_graph_from_repo(repositoryUrl: string): string {
  return JSON.stringify(buildMockGraph({ repositoryUrl }));
}

export function wasm_graph_from_source(source: string): string {
  return JSON.stringify({
    repositoryUrl: 'local-source',
    nodes: [
      { id: 'root', label: 'local', type: 'repository', parentId: null },
      { id: 'file:snippet', label: 'snippet.ts', type: 'file', parentId: 'root' },
      { id: 'source', label: source.substring(0, 32) || 'snippet', type: 'variable', parentId: 'file:snippet' },
    ],
    edges: [
      { from: 'root', to: 'file:snippet', relationship: 'contains' },
      { from: 'file:snippet', to: 'source', relationship: 'contains' },
    ],
  });
}
