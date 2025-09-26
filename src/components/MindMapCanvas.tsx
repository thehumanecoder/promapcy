"use client";

import { useEffect, useMemo, useRef } from 'react';
import type { MindMapEdge, MindMapGraph, MindMapNode, MindMapNodeType } from '@/lib/schema';

type MindMapCanvasProps = {
  graph: MindMapGraph;
};

type SimulationNode = MindMapNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

type SimulationLink = MindMapEdge & {
  source: SimulationNode | string;
  target: SimulationNode | string;
};

type D3Module = {
  select: (element: SVGSVGElement) => any;
  forceSimulation: (nodes: SimulationNode[]) => any;
  forceLink: (links: SimulationLink[]) => any;
  forceManyBody: () => any;
  forceCenter: (x: number, y: number) => any;
  forceCollide: () => any;
  zoom: () => any;
  drag: <ElementType extends Element, Datum>() => any;
};

let d3Promise: Promise<D3Module | null> | null = null;

async function loadD3(): Promise<D3Module | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!d3Promise) {
    d3Promise = import(
      /* webpackIgnore: true */ 'https://cdn.skypack.dev/d3@7.8.5?min'
    )
      .then((mod) => {
        const resolved = (mod as { default?: unknown })?.default ?? mod;
        return resolved as D3Module;
      })
      .catch(() => null);
  }

  return d3Promise;
}

const NODE_COLORS: Record<MindMapNodeType, string> = {
  repository: '#38bdf8',
  directory: '#22d3ee',
  file: '#818cf8',
  class: '#fbbf24',
  interface: '#34d399',
  function: '#fb7185',
  method: '#a855f7',
  variable: '#f97316',
  constant: '#facc15',
  enum: '#4ade80',
};

function nodeRadius(type: MindMapNodeType) {
  switch (type) {
    case 'repository':
      return 26;
    case 'directory':
      return 22;
    case 'file':
      return 18;
    case 'class':
    case 'interface':
      return 16;
    case 'function':
    case 'method':
      return 14;
    case 'variable':
    case 'constant':
    case 'enum':
    default:
      return 12;
  }
}

const RELATIONSHIP_STYLES: Record<MindMapEdge['relationship'], { strokeDasharray?: string; strokeWidth: number }> = {
  contains: { strokeWidth: 2 },
  calls: { strokeWidth: 1.5, strokeDasharray: '4 3' },
  references: { strokeWidth: 1.5, strokeDasharray: '2 2' },
  implements: { strokeWidth: 1.5, strokeDasharray: '6 4' },
  extends: { strokeWidth: 1.5, strokeDasharray: '6 2' },
};

export default function MindMapCanvas({ graph }: MindMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(() => {
    const counts = graph.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});
    return counts;
  }, [graph]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      return;
    }

    let isMounted = true;
    let cleanup: (() => void) | undefined;

    const initialise = async () => {
      const d3 = await loadD3();
      if (!d3 || !isMounted || !svgRef.current) {
        return;
      }

      const { select, forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, zoom, drag } = d3;

      const svgElement = svgRef.current;
      const svg = select(svgElement);
      svg.selectAll('*').remove();

      const width = containerRef.current?.clientWidth ?? 720;
      const height = containerRef.current?.clientHeight ?? 480;

      svg
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      const nodes: SimulationNode[] = graph.nodes.map((node) => ({ ...node }));
      const links: SimulationLink[] = graph.edges.map((edge) => ({
        ...edge,
        source: edge.from,
        target: edge.to,
      }));

      const canvas = svg.append('g');

      const linkSelection = canvas
        .append('g')
        .attr('stroke', '#475569')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', (d: SimulationLink) => RELATIONSHIP_STYLES[d.relationship].strokeWidth)
        .attr('stroke-dasharray', (d: SimulationLink) => RELATIONSHIP_STYLES[d.relationship].strokeDasharray ?? null);

      linkSelection
        .append('title')
        .text((d: SimulationLink) => `${d.from} ${d.relationship} ${d.to}`);

      const simulation = forceSimulation(nodes)
        .force(
          'link',
          forceLink(links)
            .id((d: SimulationNode) => d.id)
            .distance((link: SimulationLink) => (link.relationship === 'contains' ? 70 : 120))
            .strength((link: SimulationLink) => (link.relationship === 'contains' ? 0.7 : 0.4))
        )
        .force('charge', forceManyBody().strength(-220))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collision', forceCollide().radius((d: SimulationNode) => nodeRadius(d.type) + 12));

      const dragBehaviour = drag<SVGGElement, SimulationNode>()
        .on('start', (event: any, datum: SimulationNode) => {
          if (!event.active) {
            simulation.alphaTarget(0.3).restart();
          }
          datum.fx = datum.x ?? null;
          datum.fy = datum.y ?? null;
        })
        .on('drag', (event: any, datum: SimulationNode) => {
          datum.fx = event.x;
          datum.fy = event.y;
        })
        .on('end', (event: any, datum: SimulationNode) => {
          if (!event.active) {
            simulation.alphaTarget(0);
          }
          datum.fx = null;
          datum.fy = null;
        });

      const nodeGroups = canvas
        .append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('role', 'group')
        .attr('aria-label', (d: SimulationNode) => `${d.type} ${d.label}`)
        .call(dragBehaviour);

      nodeGroups
        .append('circle')
        .attr('r', (d: SimulationNode) => nodeRadius(d.type))
        .attr('fill', (d: SimulationNode) => NODE_COLORS[d.type])
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5);

      nodeGroups
        .append('text')
        .attr('x', (d: SimulationNode) => nodeRadius(d.type) + 6)
        .attr('y', '0.32em')
        .attr('fill', '#cbd5f5')
        .attr('font-size', 12)
        .attr('font-family', 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .text((d: SimulationNode) => d.label)
        .attr('pointer-events', 'none');

      nodeGroups
        .append('title')
        .text(
          (d: SimulationNode) => `${d.label}\nType: ${d.type}${d.documentation ? `\n${d.documentation}` : ''}`
        );

      simulation.on('tick', () => {
        linkSelection
          .attr('x1', (d: SimulationLink) => (typeof d.source === 'object' ? d.source.x ?? 0 : 0))
          .attr('y1', (d: SimulationLink) => (typeof d.source === 'object' ? d.source.y ?? 0 : 0))
          .attr('x2', (d: SimulationLink) => (typeof d.target === 'object' ? d.target.x ?? 0 : 0))
          .attr('y2', (d: SimulationLink) => (typeof d.target === 'object' ? d.target.y ?? 0 : 0));

        nodeGroups.attr('transform', (d: SimulationNode) => `translate(${d.x ?? width / 2}, ${d.y ?? height / 2})`);
      });

      const zoomBehaviour = zoom()
        .scaleExtent([0.4, 2.8])
        .on('zoom', (event: any) => {
          canvas.attr('transform', event.transform.toString());
        });

      svg.call(zoomBehaviour).on('dblclick.zoom', null);

      cleanup = () => {
        simulation.stop();
        svg.on('.zoom', null);
      };
    };

    void initialise();

    return () => {
      isMounted = false;
      if (cleanup) {
        cleanup();
      }
    };
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
      <div
        ref={containerRef}
        className="relative flex flex-1 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40"
      >
        {graph.nodes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-400">
            No nodes available to display.
          </div>
        ) : (
          <svg ref={svgRef} aria-label="Interactive mind map" role="img" className="h-full w-full cursor-move" />
        )}
      </div>
    </div>
  );
}
