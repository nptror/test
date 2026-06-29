// src/utils/exportGraph.ts
import type { GraphEdge } from '../types/map';
import type { GraphMapMeta, GraphNode } from '../types/graph';

export interface ExportedGraphData {
  meta: GraphMapMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function exportGraph(nodes: GraphNode[], edges: GraphEdge[], floorSize: number, resolution: number): string {
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    name: node.type === 'delivery' && !node.name.toLowerCase().includes('delivery')
      ? `${node.name}_Delivery`
      : node.name,
  }));

  const payload: ExportedGraphData = {
    meta: {
      version: 2,
      floorSize,
      resolution,
    },
    nodes: normalizedNodes,
    edges,
  };

  return JSON.stringify(payload, null, 2);
}
