import { render, screen } from '@testing-library/react';
import MindMapCanvas from '@/components/MindMapCanvas';
import type { MindMapGraph } from '@/lib/schema';

describe('MindMapCanvas', () => {
  it('renders summary tags for graph nodes', () => {
    const graph: MindMapGraph = {
      repositoryUrl: 'https://github.com/example/repo',
      nodes: [
        { id: 'repo', label: 'repo', type: 'repository', parentId: null },
        { id: 'file', label: 'file.ts', type: 'file', parentId: 'repo' },
        { id: 'fn', label: 'fn', type: 'function', parentId: 'file' },
      ],
      edges: [],
    };

    render(<MindMapCanvas graph={graph} />);

    expect(screen.getByText(/repository: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/file: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/function: 1/i)).toBeInTheDocument();
  });
});
