export type GraphNodeType =
  | 'robotStart'
  | 'table'
  | 'delivery'
  | 'waypoint'
  | 'kitchen'
  | 'charging';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  x: number;
  y: number;
  theta?: number;
  tableNumber?: number;
  deliveryOffsetX?: number;
  deliveryOffsetY?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
  weight?: number;
  label?: string;
}

export interface GraphMapMeta {
  version: number;
  floorSize: number;
  resolution: number;
}
