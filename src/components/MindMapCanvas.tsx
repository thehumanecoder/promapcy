import { useMemo } from 'react';
import type { MindMapGraph } from '@/lib/schema';

type MindMapCanvasProps = {
  graph: MindMapGraph;
};

export default function MindMapCanvas({ graph }: MindMapCanvasProps) {
  const summary = useMemo(() => {
    const counts = graph.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});
    return counts;
  }, [graph]);

  return (
    <div className="flex h-full flex-col gap-5" role="region" aria-label="Mind map visualisation">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.35em] text-brand-300">Repository</p>
        <h3 className="text-2xl font-semibold text-slate-50">{graph.repositoryUrl}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary).map(([type, value]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-200"
            >
              <span className="h-2 w-2 rounded-full bg-brand-400" aria-hidden />
              {type}: {value}
            </span>
          ))}
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        Interactive mind map rendering is coming soon. Graph statistics appear above in the meantime.
      </div>
    </div>
  );
}
