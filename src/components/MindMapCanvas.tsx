"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const RELATIONSHIP_PHRASES: Record<
  MindMapEdge['relationship'],
  { incoming: string; outgoing: string }
> = {
  contains: { outgoing: 'contains', incoming: 'is contained within' },
  calls: { outgoing: 'calls', incoming: 'is called by' },
  references: { outgoing: 'references', incoming: 'is referenced by' },
  implements: { outgoing: 'implements', incoming: 'is implemented by' },
  extends: { outgoing: 'extends', incoming: 'is extended by' },
};

type ConnectionDirection = 'incoming' | 'outgoing';

type ConnectionDetail = {
  edge: MindMapEdge;
  direction: ConnectionDirection;
  counterpart: MindMapNode | null;
  isVisible: boolean;
};

export default function MindMapCanvas({ graph }: MindMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodeSelectionRef = useRef<any>(null);
  const linkSelectionRef = useRef<any>(null);

  const [d3Module, setD3Module] = useState<D3Module | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 720, height: 480 });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const counts = graph.nodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});
    return counts;
  }, [graph]);

  const nodesById = useMemo(() => {
    return new Map(graph.nodes.map((node) => [node.id, node] as const));
  }, [graph.nodes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, MindMapNode[]>();
    for (const node of graph.nodes) {
      const key = node.parentId;
      const existing = map.get(key);
      if (existing) {
        existing.push(node);
      } else {
        map.set(key, [node]);
      }
    }
    return map;
  }, [graph.nodes]);

  const expandableNodeIds = useMemo(() => {
    const set = new Set<string>();
    childrenByParent.forEach((children, parentId) => {
      if (parentId) {
        set.add(parentId);
      }
    });
    return set;
  }, [childrenByParent]);

  const rootNodes = useMemo(() => childrenByParent.get(null) ?? [], [childrenByParent]);

  const visibleNodeIds = useMemo(() => {
    if (graph.nodes.length === 0) {
      return new Set<string>();
    }

    const visible = new Set<string>();
    const visit = (node: MindMapNode | undefined) => {
      if (!node || visible.has(node.id)) {
        return;
      }
      visible.add(node.id);
      if (expandedNodeIds.has(node.id)) {
        const children = childrenByParent.get(node.id) ?? [];
        children.forEach((child) => visit(child));
      }
    };

    if (rootNodes.length > 0) {
      rootNodes.forEach((root) => visit(root));
    } else {
      graph.nodes
        .filter((candidate) => candidate.parentId === null)
        .forEach((orphanRoot) => visit(orphanRoot));
    }

    return visible;
  }, [graph.nodes, childrenByParent, expandedNodeIds, rootNodes]);

  const visibleNodes = useMemo(
    () => graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    [graph.nodes, visibleNodeIds]
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
      ),
    [graph.edges, visibleNodeIds]
  );

  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;

  const relatedVisibleNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }
    const related = new Set<string>([selectedNodeId]);
    for (const edge of visibleEdges) {
      if (edge.from === selectedNodeId) {
        related.add(edge.to);
      }
      if (edge.to === selectedNodeId) {
        related.add(edge.from);
      }
    }
    return related;
  }, [selectedNodeId, visibleEdges]);

  const connectionDetails = useMemo<ConnectionDetail[]>(() => {
    if (!selectedNodeId) {
      return [];
    }

    const details: ConnectionDetail[] = [];
    for (const edge of graph.edges) {
      if (edge.from === selectedNodeId || edge.to === selectedNodeId) {
        const direction: ConnectionDirection = edge.from === selectedNodeId ? 'outgoing' : 'incoming';
        const counterpartId = direction === 'outgoing' ? edge.to : edge.from;
        const counterpart = nodesById.get(counterpartId) ?? null;
        details.push({
          edge,
          direction,
          counterpart,
          isVisible: visibleNodeIds.has(counterpartId),
        });
      }
    }

    details.sort((a, b) => {
      if (a.direction !== b.direction) {
        return a.direction === 'outgoing' ? -1 : 1;
      }
      if (a.edge.relationship === b.edge.relationship) {
        const labelA = a.counterpart?.label ?? a.edge.to;
        const labelB = b.counterpart?.label ?? b.edge.to;
        return labelA.localeCompare(labelB);
      }
      return a.edge.relationship.localeCompare(b.edge.relationship);
    });

    return details;
  }, [graph.edges, nodesById, selectedNodeId, visibleNodeIds]);

  const groupedConnections = useMemo(() => {
    const map = new Map<string, { relationship: MindMapEdge['relationship']; direction: ConnectionDirection; entries: ConnectionDetail[] }>();

    for (const detail of connectionDetails) {
      const key = `${detail.edge.relationship}:${detail.direction}`;
      const existing = map.get(key);
      if (existing) {
        existing.entries.push(detail);
      } else {
        map.set(key, {
          relationship: detail.edge.relationship,
          direction: detail.direction,
          entries: [detail],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.direction !== b.direction) {
        return a.direction === 'outgoing' ? -1 : 1;
      }
      return a.relationship.localeCompare(b.relationship);
    });
  }, [connectionDetails]);

  const collapsedChildren = useMemo(() => {
    if (!selectedNodeId) {
      return [] as MindMapNode[];
    }
    const children = childrenByParent.get(selectedNodeId) ?? [];
    return children.filter((child) => !visibleNodeIds.has(child.id));
  }, [childrenByParent, selectedNodeId, visibleNodeIds]);

  const ancestry = useMemo(() => {
    if (!selectedNode) {
      return [] as MindMapNode[];
    }
    const chain: MindMapNode[] = [];
    let current: MindMapNode | undefined | null = selectedNode;
    while (current) {
      chain.push(current);
      if (!current.parentId) {
        break;
      }
      current = nodesById.get(current.parentId) ?? null;
    }
    return chain.reverse();
  }, [nodesById, selectedNode]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    let cancelled = false;
    const initialise = async () => {
      const module = await loadD3();
      if (!cancelled) {
        setD3Module(module);
      }
    };

    void initialise();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const rootNode = graph.nodes.find((node) => node.parentId === null) ?? graph.nodes[0] ?? null;
    setExpandedNodeIds((prev) => {
      if (rootNode && prev.size === 1 && prev.has(rootNode.id)) {
        return prev;
      }
      const initial = new Set<string>();
      if (rootNode) {
        initial.add(rootNode.id);
      }
      return initial;
    });
    setSelectedNodeId((prev) => {
      if (prev && graph.nodes.some((node) => node.id === prev)) {
        return prev;
      }
      return rootNode ? rootNode.id : null;
    });
  }, [graph]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleFullscreenChange = () => {
      const element = containerRef.current;
      setIsFullscreen(document.fullscreenElement === element);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const width = element.clientWidth || 720;
      const height = element.clientHeight || 480;
      setDimensions({ width, height });
    };

    updateSize();

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setDimensions({ width, height });
        }
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }

    const handleResize = () => updateSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isFullscreen]);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const revealNode = useCallback(
    (targetId: string) => {
      const target = nodesById.get(targetId);
      if (!target) {
        return;
      }
      setExpandedNodeIds((prev) => {
        const next = new Set(prev);
        let current: MindMapNode | undefined | null = target;
        while (current?.parentId) {
          next.add(current.parentId);
          current = nodesById.get(current.parentId) ?? null;
        }
        return next;
      });
      setSelectedNodeId(targetId);
    },
    [nodesById]
  );

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const request = element.requestFullscreen?.bind(element);
    const exit = document.exitFullscreen?.bind(document);

    if (document.fullscreenElement === element) {
      void exit?.();
      return;
    }
    if (!document.fullscreenElement) {
      void request?.();
      return;
    }
    void exit?.().then(() => request?.());
  }, []);

  useEffect(() => {
    if (!svgRef.current || !d3Module || process.env.NODE_ENV === 'test') {
      return;
    }

    if (visibleNodes.length === 0) {
      const svgElement = svgRef.current;
      if (svgElement) {
        while (svgElement.firstChild) {
          svgElement.removeChild(svgElement.firstChild);
        }
      }
      nodeSelectionRef.current = null;
      linkSelectionRef.current = null;
      return;
    }

    const { select, forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, zoom, drag } = d3Module;

    const svgElement = svgRef.current;
    const svg = select(svgElement);
    svg.selectAll('*').remove();

    svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${Math.max(dimensions.width, 120)} ${Math.max(dimensions.height, 120)}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'presentation');

    const nodes: SimulationNode[] = visibleNodes.map((node) => ({ ...node }));
    const links: SimulationLink[] = visibleEdges.map((edge) => ({
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
      .data(links, (d: any) => `${d.from}-${d.to}-${d.relationship}`)
      .join('line')
      .attr('stroke-width', (d: SimulationLink) => RELATIONSHIP_STYLES[d.relationship].strokeWidth)
      .attr('stroke-dasharray', (d: SimulationLink) => RELATIONSHIP_STYLES[d.relationship].strokeDasharray ?? null);

    linkSelection.append('title').text((d: SimulationLink) => `${d.from} ${d.relationship} ${d.to}`);

    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink(links)
          .id((d: SimulationNode) => d.id)
          .distance((link: SimulationLink) => (link.relationship === 'contains' ? 70 : 130))
          .strength((link: SimulationLink) => (link.relationship === 'contains' ? 0.8 : 0.45))
      )
      .force('charge', forceManyBody().strength(-240))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', forceCollide().radius((d: SimulationNode) => nodeRadius(d.type) + 14));

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
      .data(nodes, (d: any) => d.id)
      .join('g')
      .attr('role', 'group')
      .attr('aria-label', (d: SimulationNode) => `${d.type} ${d.label}`)
      .style('cursor', 'pointer')
      .call(dragBehaviour);

    nodeGroups
      .append('circle')
      .attr('r', (d: SimulationNode) => nodeRadius(d.type))
      .attr('fill', (d: SimulationNode) => NODE_COLORS[d.type])
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.6);

    nodeGroups
      .append('text')
      .attr('x', (d: SimulationNode) => nodeRadius(d.type) + 6)
      .attr('y', '0.32em')
      .attr('fill', '#e2e8f0')
      .attr('font-size', 12)
      .attr(
        'font-family',
        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      )
      .text((d: SimulationNode) => d.label)
      .attr('pointer-events', 'none');

    nodeGroups
      .append('title')
      .text(
        (d: SimulationNode) =>
          `${d.label}\nType: ${d.type}${d.documentation ? `\n${d.documentation}` : ''}`
      );

    const expandableGroups = nodeGroups.filter((d: SimulationNode) => expandableNodeIds.has(d.id));

    expandableGroups
      .append('circle')
      .attr('class', 'expand-handle')
      .attr('cx', 0)
      .attr('cy', (d: SimulationNode) => nodeRadius(d.type) + 12)
      .attr('r', 8)
      .attr('fill', '#0f172a')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.2);

    expandableGroups
      .append('text')
      .attr('class', 'expand-symbol')
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('y', (d: SimulationNode) => nodeRadius(d.type) + 12 + 4)
      .attr('fill', '#38bdf8')
      .text((d: SimulationNode) => (expandedNodeIds.has(d.id) ? '−' : '+'))
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d: SimulationLink) => (typeof d.source === 'object' ? d.source.x ?? 0 : 0))
        .attr('y1', (d: SimulationLink) => (typeof d.source === 'object' ? d.source.y ?? 0 : 0))
        .attr('x2', (d: SimulationLink) => (typeof d.target === 'object' ? d.target.x ?? 0 : 0))
        .attr('y2', (d: SimulationLink) => (typeof d.target === 'object' ? d.target.y ?? 0 : 0));

      nodeGroups.attr('transform', (d: SimulationNode) => `translate(${d.x ?? dimensions.width / 2}, ${d.y ?? dimensions.height / 2})`);
    });

    const zoomBehaviour = zoom()
      .scaleExtent([0.35, 2.8])
      .on('zoom', (event: any) => {
        canvas.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehaviour).on('dblclick.zoom', null);

    svg.on('click', () => {
      setSelectedNodeId(null);
    });

    nodeGroups.on('click', (event: any, datum: SimulationNode) => {
      event.stopPropagation();
      setSelectedNodeId(datum.id);
    });

    nodeGroups.on('dblclick', (event: any, datum: SimulationNode) => {
      event.stopPropagation();
      toggleNodeExpansion(datum.id);
    });

    nodeSelectionRef.current = nodeGroups;
    linkSelectionRef.current = linkSelection;
    return () => {
      simulation.stop();
      svg.on('.zoom', null);
      svg.on('click', null);
      nodeSelectionRef.current = null;
      linkSelectionRef.current = null;
    };
  }, [d3Module, dimensions.height, dimensions.width, expandableNodeIds, expandedNodeIds, toggleNodeExpansion, visibleEdges, visibleNodes]);

  useEffect(() => {
    const nodeSelection = nodeSelectionRef.current;
    const linkSelection = linkSelectionRef.current;
    if (!nodeSelection || !linkSelection) {
      return;
    }

    const relatedIds = new Set(relatedVisibleNodeIds);

    nodeSelection
      .selectAll('circle')
      .attr('stroke-width', (d: SimulationNode) => (d.id === selectedNodeId ? 3 : 1.6))
      .attr('stroke', (d: SimulationNode) => (d.id === selectedNodeId ? '#f8fafc' : '#0f172a'))
      .attr('opacity', (d: SimulationNode) => (!selectedNodeId || relatedIds.has(d.id) ? 1 : 0.35));

    nodeSelection
      .selectAll('text')
      .attr('opacity', (d: SimulationNode) => (!selectedNodeId || relatedIds.has(d.id) ? 1 : 0.5));

    nodeSelection
      .attr('opacity', (d: SimulationNode) => (!selectedNodeId || relatedIds.has(d.id) ? 1 : 0.5));

    linkSelection
      .attr('stroke', (d: SimulationLink) =>
        d.from === selectedNodeId || d.to === selectedNodeId ? '#cbd5f5' : '#475569'
      )
      .attr('stroke-opacity', (d: SimulationLink) =>
        !selectedNodeId || d.from === selectedNodeId || d.to === selectedNodeId ? 0.85 : 0.25
      );
  }, [relatedVisibleNodeIds, selectedNodeId]);

  const hasNodes = graph.nodes.length > 0;

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
        className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/50 shadow-inner"
      >
        {!hasNodes ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-400">
            No nodes available to display.
          </div>
        ) : (
          <>
            <div className="pointer-events-none absolute left-0 top-0 z-10 flex w-full justify-between gap-2 p-3">
              <div className="pointer-events-auto inline-flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-slate-800/70 px-3 py-1">Click to inspect</span>
                <span className="rounded-full bg-slate-800/70 px-3 py-1">Double click to expand/collapse</span>
                <span className="rounded-full bg-slate-800/70 px-3 py-1">Drag nodes to explore</span>
              </div>
              <div className="pointer-events-auto inline-flex gap-2">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-slate-400/80 hover:text-white"
                >
                  {isFullscreen ? 'Exit full screen' : 'Maximise view'}
                </button>
              </div>
            </div>
            <div className="flex h-full flex-1 flex-col lg:flex-row">
              <div ref={canvasRef} className="relative flex-1">
                <svg
                  ref={svgRef}
                  aria-label="Interactive mind map"
                  role="img"
                  className="h-full w-full cursor-move"
                />
              </div>
              <aside className="flex w-full flex-col gap-4 border-t border-slate-700/60 bg-slate-900/80 p-4 text-sm text-slate-200 backdrop-blur lg:w-80 lg:border-l lg:border-t-0">
                {selectedNode ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-brand-300">Focused entity</p>
                      <h4 className="text-lg font-semibold text-slate-50">{selectedNode.label}</h4>
                      <p className="text-xs uppercase text-slate-400">{selectedNode.type}</p>
                      {selectedNode.location && (
                        <p className="text-xs text-slate-400">
                          {selectedNode.location}
                        </p>
                      )}
                      {selectedNode.documentation && (
                        <p className="text-xs text-slate-300">{selectedNode.documentation}</p>
                      )}
                    </div>
                    {ancestry.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-300">
                        {ancestry.map((node, index) => (
                          <span key={node.id} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded bg-slate-800/60 px-2 py-1 hover:bg-slate-700/70"
                              onClick={() => {
                                revealNode(node.id);
                              }}
                            >
                              {node.label}
                            </button>
                            {index < ancestry.length - 1 && <span aria-hidden>›</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    {collapsedChildren.length > 0 && (
                      <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3 text-xs text-slate-200">
                        <p className="font-semibold text-slate-100">
                          {collapsedChildren.length} nested {collapsedChildren.length === 1 ? 'item' : 'items'} hidden
                        </p>
                        <p className="mt-1 text-slate-300">
                          Double click the node or use the button below to reveal its inner structure.
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleNodeExpansion(selectedNode.id)}
                          className="mt-2 inline-flex items-center gap-1 rounded border border-brand-400/70 px-2 py-1 text-[11px] font-semibold text-brand-200 hover:border-brand-300 hover:text-brand-100"
                        >
                          {expandedNodeIds.has(selectedNode.id) ? 'Collapse children' : 'Expand children'}
                        </button>
                      </div>
                    )}
                    <section className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
                        Data flow & relationships
                      </h5>
                      {groupedConnections.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No relationships detected yet. Expand neighbouring nodes to discover more links.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {groupedConnections.map((group) => (
                            <div key={`${group.relationship}-${group.direction}`} className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-3">
                              <p className="text-xs font-semibold text-slate-100">
                                {selectedNode.label} {RELATIONSHIP_PHRASES[group.relationship][group.direction]}:
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                                {group.entries.map((detail) => (
                                  <li key={`${detail.edge.from}-${detail.edge.to}-${detail.edge.relationship}-${detail.direction}`} className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      className="truncate text-left hover:text-brand-200"
                                      onClick={() => {
                                        if (detail.counterpart) {
                                          if (!detail.isVisible) {
                                            revealNode(detail.counterpart.id);
                                          } else {
                                            setSelectedNodeId(detail.counterpart.id);
                                          }
                                        }
                                      }}
                                    >
                                      {detail.counterpart?.label ?? detail.edge.to}
                                    </button>
                                    {!detail.isVisible && detail.counterpart && (
                                      <span className="rounded bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                        hidden
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">
                    Click on a node inside the mind map to inspect how data moves between entities.
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

