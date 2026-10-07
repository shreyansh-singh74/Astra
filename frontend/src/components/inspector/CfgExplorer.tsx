'use client';

import React, { useState, useMemo } from 'react';
import { Activity, GitMerge } from 'lucide-react';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

interface CFGNode {
  id: string;
  type: string;
  label: string;
  start_byte: number;
  end_byte: number;
  start_line: number;
  end_line: number;
  code: string;
}

interface CFGEdge {
  source: string;
  target: string;
}

interface CFGGraph {
  nodes: CFGNode[];
  edges: CFGEdge[];
}

interface CfgExplorerProps {
  studentCfg: CFGGraph;
  refCfg: CFGGraph;
  onSelectStudentNode: (range: CodeRange | null) => void;
  onSelectRefNode: (range: CodeRange | null) => void;
}

export default function CfgExplorer({
  studentCfg,
  refCfg,
  onSelectStudentNode,
  onSelectRefNode,
}: CfgExplorerProps) {
  const [activeStudentNodeId, setActiveStudentNodeId] = useState<string | null>(null);
  const [activeRefNodeId, setActiveRefNodeId] = useState<string | null>(null);

  const layoutGraph = (graph: CFGGraph, width: number = 520) => {
    if (!graph.nodes || graph.nodes.length === 0) {
      return { nodes: [], edges: [], svgHeight: 200 };
    }

    // Build adjacency list and in-degree for topological sort
    const adj: Record<string, string[]> = {};
    const radj: Record<string, string[]> = {}; // reverse adjacency
    const inDegree: Record<string, number> = {};
    graph.nodes.forEach(n => { adj[n.id] = []; radj[n.id] = []; inDegree[n.id] = 0; });

    // Detect back-edges (loop back-edges) using DFS to avoid them in topological sort
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const backEdges = new Set<string>();
    const entryNode = graph.nodes.find(n => n.type === 'entry') || graph.nodes[0];

    const dfs = (u: string) => {
      visited.add(u);
      inStack.add(u);
      for (const v of (graph.edges.filter(e => e.source === u).map(e => e.target))) {
        if (!visited.has(v)) {
          dfs(v);
        } else if (inStack.has(v)) {
          backEdges.add(`${u}->${v}`);
        }
      }
      inStack.delete(u);
    };
    dfs(entryNode.id);

    // Build DAG adjacency (excluding back-edges)
    graph.edges.forEach(e => {
      if (!backEdges.has(`${e.source}->${e.target}`)) {
        adj[e.source].push(e.target);
        radj[e.target].push(e.source);
        inDegree[e.target]++;
      }
    });

    // Topological sort (Kahn's algorithm)
    const topoQueue: string[] = [];
    graph.nodes.forEach(n => { if (inDegree[n.id] === 0) topoQueue.push(n.id); });
    const topoOrder: string[] = [];
    const tempInDeg = { ...inDegree };
    while (topoQueue.length > 0) {
      const u = topoQueue.shift()!;
      topoOrder.push(u);
      for (const v of adj[u]) {
        tempInDeg[v]--;
        if (tempInDeg[v] === 0) topoQueue.push(v);
      }
    }
    // Any nodes not reached (due to cycles) go to the end
    graph.nodes.forEach(n => { if (!topoOrder.includes(n.id)) topoOrder.push(n.id); });

    // Longest-path layering: level[v] = max(level[u] + 1) for all u → v
    const levels: Record<string, number> = {};
    topoOrder.forEach(u => {
      // level is max of all predecessors + 1
      const preds = radj[u] || [];
      if (preds.length === 0) {
        levels[u] = levels[u] ?? 0;
      } else {
        levels[u] = Math.max(...preds.map(p => (levels[p] ?? 0) + 1), levels[u] ?? 0);
      }
    });

    // Group nodes by level
    const levelGroups: Record<number, string[]> = {};
    graph.nodes.forEach(n => {
      const lvl = levels[n.id] ?? 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n.id);
    });

    // Compute per-node widths based on label length (7px per char + 24px padding, clamped)
    const nodeWidths: Record<string, number> = {};
    graph.nodes.forEach(n => {
      nodeWidths[n.id] = Math.max(120, Math.min(280, n.label.length * 7 + 24));
    });

    // Assign (x, y) positions
    const NODE_HEIGHT = 36;
    const LEVEL_GAP = 72;
    const positions: Record<string, { x: number; y: number }> = {};
    const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
    const totalLevels = sortedLevels.length;
    const svgHeight = Math.max(200, 45 + totalLevels * LEVEL_GAP + NODE_HEIGHT);

    sortedLevels.forEach((lvl, lvlIdx) => {
      const ids = levelGroups[lvl];
      const count = ids.length;
      const y = 45 + lvlIdx * LEVEL_GAP;
      // Use the widest node at this level to determine the spread gap
      const maxNodeW = Math.max(...ids.map(id => nodeWidths[id] ?? 140));
      const gap = maxNodeW + 20; // 20px inter-node gap

      ids.forEach((id, idx) => {
        let x = width / 2;
        if (count > 1) {
          const totalSpread = (count - 1) * gap;
          x = (width / 2) - (totalSpread / 2) + idx * gap;
        }
        positions[id] = { x, y };
      });
    });

    return {
      nodes: graph.nodes.map(n => ({
        ...n,
        x: positions[n.id]?.x ?? width / 2,
        y: positions[n.id]?.y ?? 45,
      })),
      edges: graph.edges.map(e => ({
        ...e,
        isBackEdge: backEdges.has(`${e.source}->${e.target}`),
        x1: positions[e.source]?.x ?? width / 2,
        y1: positions[e.source]?.y ?? 45,
        x2: positions[e.target]?.x ?? width / 2,
        y2: positions[e.target]?.y ?? 45,
      })),
      svgHeight,
    };
  };

  const studentLayout = useMemo(() => layoutGraph(studentCfg, 520), [studentCfg]);
  const refLayout = useMemo(() => layoutGraph(refCfg, 520), [refCfg]);

  const handleStudentNodeClick = (node: CFGNode) => {
    setActiveStudentNodeId(node.id);
    onSelectStudentNode({
      start_line: node.start_line,
      end_line: node.end_line,
      start_byte: node.start_byte,
      end_byte: node.end_byte,
    });

    const nodeType = node.type;
    const studentNodesOfType = studentCfg.nodes.filter(n => n.type === nodeType);
    const occurrenceIndex = studentNodesOfType.findIndex(n => n.id === node.id);

    if (occurrenceIndex !== -1) {
      const refNodesOfType = refCfg.nodes.filter(n => n.type === nodeType);
      if (refNodesOfType[occurrenceIndex]) {
        const equivalentRefNode = refNodesOfType[occurrenceIndex];
        setActiveRefNodeId(equivalentRefNode.id);
        onSelectRefNode({
          start_line: equivalentRefNode.start_line,
          end_line: equivalentRefNode.end_line,
          start_byte: equivalentRefNode.start_byte,
          end_byte: equivalentRefNode.end_byte,
        });
      }
    }
  };

  const handleRefNodeClick = (node: CFGNode) => {
    setActiveRefNodeId(node.id);
    onSelectRefNode({
      start_line: node.start_line,
      end_line: node.end_line,
      start_byte: node.start_byte,
      end_byte: node.end_byte,
    });
  };

  const getNodeColor = (type: string, isActive: boolean) => {
    if (isActive) return { fill: 'var(--accent-primary)', border: '#fff', text: '#fff' };
    switch (type) {
      case 'entry':
      case 'exit':
        return { fill: 'var(--bg-elevated)', border: 'var(--accent-success)', text: 'var(--accent-success)' };
      case 'loop':
        return { fill: 'var(--bg-elevated)', border: 'var(--accent-warning)', text: 'var(--accent-warning)' };
      case 'branch':
        return { fill: 'var(--bg-elevated)', border: 'var(--accent-purple)', text: 'var(--accent-purple)' };
      default:
        return { fill: 'var(--bg-elevated)', border: 'var(--border-color)', text: 'var(--text-primary)' };
    }
  };

  const SVG_WIDTH = 520;
  // Approximate node width from label: 7px/char + 24px padding, clamped 120–280
  const getNodeWidth = (label: string) => Math.max(120, Math.min(280, label.length * 7 + 24));

  const renderSvgGraph = (
    layout: ReturnType<typeof layoutGraph>,
    activeId: string | null,
    onNodeClick: (node: CFGNode) => void
  ) => {
    const svgH = layout.svgHeight ?? 380;
    return (
      <div style={{ overflowY: 'auto', maxHeight: '420px', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)' }}>
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${SVG_WIDTH} ${svgH}`}
          style={{ display: 'block' }}
        >
          <defs>
            <marker id="cfg-arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
            </marker>
            <marker id="cfg-arrow-back" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-warning)" />
            </marker>
          </defs>

          {/* Edges */}
          {layout.edges.map((e, idx) => {
            const isBack = (e as { isBackEdge?: boolean }).isBackEdge;
            if (isBack) {
              // Curved back-edge for loops (arc to the left)
              const cx = Math.min(e.x1, e.x2) - 50;
              return (
                <path
                  key={`e-${idx}`}
                  d={`M ${e.x1} ${e.y1} C ${cx} ${e.y1}, ${cx} ${e.y2}, ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke="var(--accent-warning)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  markerEnd="url(#cfg-arrow-back)"
                />
              );
            }
            return (
              <line
                key={`e-${idx}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke="var(--border-color)"
                strokeWidth="1.5"
                markerEnd="url(#cfg-arrow)"
              />
            );
          })}

          {/* Nodes */}
          {layout.nodes.map(node => {
            const isActive = activeId === node.id;
            const colors = getNodeColor(node.type, isActive);
            const nodeW = getNodeWidth(node.label);
            const nodeH = 36;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x - nodeW / 2}, ${node.y - nodeH / 2})`}
                onClick={() => onNodeClick(node)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width={nodeW}
                  height={nodeH}
                  rx={7}
                  fill={colors.fill}
                  stroke={colors.border}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  filter={isActive ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))' : 'none'}
                />
                <text
                  x={nodeW / 2}
                  y={nodeH / 2 + 4}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                  style={{ userSelect: 'none' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
      {/* Student CFG */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={15} className="text-accent-primary" />
            Student Control Flow Graph (CFG)
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click node to sync code</span>
        </div>
        {renderSvgGraph(studentLayout, activeStudentNodeId, handleStudentNodeClick)}
      </div>

      {/* Reference CFG */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <GitMerge size={15} style={{ color: 'var(--accent-warning)' }} />
            AI Reference Control Flow Graph
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Equivalent topology highlighted</span>
        </div>
        {renderSvgGraph(refLayout, activeRefNodeId, handleRefNodeClick)}
      </div>
    </div>
  );
}
