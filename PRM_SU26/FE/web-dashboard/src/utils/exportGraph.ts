// src/utils/exportGraph.ts
import type { GraphEdge } from '../types/map';
import type { GraphMapMeta, GraphNode } from '../types/graph';

export interface ExportedGraphData {
  meta: GraphMapMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function exportGraph(nodes: GraphNode[], edges: GraphEdge[], floorSize: number, resolution: number): string {
  const payload: ExportedGraphData = {
    meta: {
      version: 1,
      floorSize,
      resolution,
    },
    nodes,
    edges,
  };

  return JSON.stringify(payload, null, 2);
}
