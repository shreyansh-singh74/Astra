'use client';

import React, { useState, useMemo } from 'react';

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

interface CfgVisualizerProps {
  studentCfg: CFGGraph;
  refCfg: CFGGraph;
  onSelectStudentNode: (range: CodeRange | null) => void;
  onSelectRefNode: (range: CodeRange | null) => void;
}

export default function CfgVisualizer({
  studentCfg,
  refCfg,
  onSelectStudentNode,
  onSelectRefNode,
}: CfgVisualizerProps) {
  const [activeStudentNodeId, setActiveStudentNodeId] = useState<string | null>(null);
  const [activeRefNodeId, setActiveRefNodeId] = useState<string | null>(null);

  // Compute layered layout coordinates for a CFG graph
  const layoutGraph = (graph: CFGGraph, width: number = 320, height: number = 340) => {
    if (!graph.nodes || graph.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const adj: Record<string, string[]> = {};
    graph.nodes.forEach(n => adj[n.id] = []);
    graph.edges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e.target);
    });

    // BFS to find layers
    const levels: Record<string, number> = {};
    const entryNode = graph.nodes.find(n => n.type === 'entry') || graph.nodes[0];
    levels[entryNode.id] = 0;
    
    const queue = [entryNode.id];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = levels[u];
      
      const children = adj[u] || [];
      children.forEach(v => {
        if (levels[v] === undefined) {
          levels[v] = currentLevel + 1;
          queue.push(v);
        }
      });
    }

    // Default any missed nodes (cycles/unreachables)
    graph.nodes.forEach(n => {
      if (levels[n.id] === undefined) {
        levels[n.id] = graph.nodes.length - 1;
      }
    });

    // Group nodes by level
    const levelGroups: Record<number, string[]> = {};
    graph.nodes.forEach(n => {
      const lvl = levels[n.id];
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n.id);
    });

    // Assign positions
    const positions: Record<string, { x: number; y: number }> = {};
    const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
    
    sortedLevels.forEach((lvl, lvlIdx) => {
      const ids = levelGroups[lvl];
      const count = ids.length;
      const y = 35 + lvlIdx * 45; // Vertical spacing

      ids.forEach((id, idx) => {
        let x = width / 2;
        if (count > 1) {
          const totalWidth = 140;
          x = (width / 2) - (totalWidth / 2) + (idx / (count - 1)) * totalWidth;
        }
        positions[id] = { x, y };
      });
    });

    return {
      nodes: graph.nodes.map(n => ({
        ...n,
        x: positions[n.id]?.x || width / 2,
        y: positions[n.id]?.y || height / 2,
      })),
      edges: graph.edges.map(e => ({
        ...e,
        x1: positions[e.source]?.x || width / 2,
        y1: positions[e.source]?.y || height / 2,
        x2: positions[e.target]?.x || width / 2,
        y2: positions[e.target]?.y || height / 2,
      })),
    };
  };

  const studentLayout = useMemo(() => layoutGraph(studentCfg), [studentCfg]);
  const refLayout = useMemo(() => layoutGraph(refCfg), [refCfg]);

  const handleStudentNodeClick = (node: CFGNode) => {
    setActiveStudentNodeId(node.id);
    onSelectStudentNode({
      start_line: node.start_line,
      end_line: node.end_line,
      start_byte: node.start_byte,
      end_byte: node.end_byte,
    });

    // Find the equivalent node type and occurrence index in Reference CFG
    // E.g., if this clicked node is the k-th loop node in the student layout, 
    // find the k-th loop node in the reference layout.
    const nodeType = node.type;
    const studentNodesOfType = studentCfg.nodes.filter(n => n.type === nodeType);
    const occurrenceIndex = studentNodesOfType.findIndex(n => n.id === node.id);

    if (occurrenceIndex !== -1) {
      const refNodesOfType = refCfg.nodes.filter(n => n.type === nodeType);
      const matchingRefNode = refNodesOfType[occurrenceIndex];

      if (matchingRefNode) {
        setActiveRefNodeId(matchingRefNode.id);
        onSelectRefNode({
          start_line: matchingRefNode.start_line,
          end_line: matchingRefNode.end_line,
          start_byte: matchingRefNode.start_byte,
          end_byte: matchingRefNode.end_byte,
        });
      } else {
        setActiveRefNodeId(null);
        onSelectRefNode(null);
      }
    }
  };

  return (
    <div className="cfg-container">
      <div className="cfg-canvas">
        <div className="cfg-canvas-title">Student CFG Layout</div>
        {studentLayout.nodes.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No CFG data available
          </div>
        ) : (
          <svg className="cfg-svg">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255,255,255,0.4)" />
              </marker>
              <marker id="arrow-highlight" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="var(--accent-secondary)" />
              </marker>
            </defs>

            {/* Render Edges */}
            {studentLayout.edges.map((e, idx) => {
              const isHighlight = e.source === activeStudentNodeId;
              return (
                <line
                  key={`st-ed-${idx}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  className={`cfg-edge ${isHighlight ? 'highlight' : ''}`}
                  markerEnd={isHighlight ? "url(#arrow-highlight)" : "url(#arrow)"}
                />
              );
            })}

            {/* Render Nodes */}
            {studentLayout.nodes.map(n => {
              const isActive = n.id === activeStudentNodeId;
              let nodeClass = 'cfg-node';
              if (n.type === 'entry') nodeClass += ' cfg-node-entry';
              if (n.type === 'exit') nodeClass += ' cfg-node-exit';
              if (n.type === 'loop') nodeClass += ' cfg-node-loop';
              if (isActive) nodeClass += ' cfg-node-highlight';

              return (
                <g
                  key={n.id}
                  className={nodeClass}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => handleStudentNodeClick(n)}
                >
                  <circle r="10" />
                  <text dy="-15" textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="cfg-canvas">
        <div className="cfg-canvas-title">AI Reference CFG Layout (Highlights Sync)</div>
        {refLayout.nodes.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No CFG data available
          </div>
        ) : (
          <svg className="cfg-svg">
            {/* Render Edges */}
            {refLayout.edges.map((e, idx) => {
              const isHighlight = e.source === activeRefNodeId;
              return (
                <line
                  key={`ref-ed-${idx}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  className={`cfg-edge ${isHighlight ? 'highlight' : ''}`}
                  markerEnd={isHighlight ? "url(#arrow-highlight)" : "url(#arrow)"}
                />
              );
            })}

            {/* Render Nodes */}
            {refLayout.nodes.map(n => {
              const isActive = n.id === activeRefNodeId;
              let nodeClass = 'cfg-node';
              if (n.type === 'entry') nodeClass += ' cfg-node-entry';
              if (n.type === 'exit') nodeClass += ' cfg-node-exit';
              if (n.type === 'loop') nodeClass += ' cfg-node-loop';
              if (isActive) nodeClass += ' cfg-node-highlight';

              return (
                <g
                  key={n.id}
                  className={nodeClass}
                  transform={`translate(${n.x}, ${n.y})`}
                >
                  <circle r="10" />
                  <text dy="-15" textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
