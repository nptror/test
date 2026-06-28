// src/types/map.ts
export type MapObjectType =
  | 'table'
  | 'chair'
  | 'wall'
  | 'kitchen'
  | 'delivery'
  | 'charging'
  | 'restricted'
  | 'door'
  | 'robotStart'
  | 'waypoint';

// ✅ Thêm export MapTool
export type MapTool =
  | 'select'
  | 'pan'
  | 'table'
  | 'chair'
  | 'delivery'
  | 'kitchen'
  | 'charging'
  | 'wall'
  | 'restricted'
  | 'door'
  | 'robotStart'
  | 'waypoint'
  | 'node'
  | 'edge';

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
  weight?: number;
  label?: string;
}

export interface MapObject {
  id: string;
  type: MapObjectType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  tableNumber?: number;
  deliveryOffsetX?: number;
  deliveryOffsetY?: number;
}