export type RepositoryHost = 'github' | 'gitlab' | 'bitbucket';

export type MindMapNodeType =
  | 'repository'
  | 'directory'
  | 'file'
  | 'class'
  | 'interface'
  | 'function'
  | 'method'
  | 'variable'
  | 'constant'
  | 'enum';

export type MindMapNode = {
  id: string;
  label: string;
  type: MindMapNodeType;
  parentId: string | null;
  location?: string;
  documentation?: string;
};

export type MindMapEdge = {
  from: string;
  to: string;
  relationship: 'contains' | 'calls' | 'references' | 'implements' | 'extends';
};

export type MindMapGraph = {
  repositoryUrl: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};

export type AnalysisResult = {
  graph: MindMapGraph;
  warnings: string[];
};
