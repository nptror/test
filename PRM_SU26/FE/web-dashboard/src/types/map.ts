// src/types/map.ts
export type MapObjectType =
  | 'wall'
  | 'table'
  | 'chair'
  | 'restricted'
  | 'delivery'
  | 'robotStart'
  | 'waypoint'
  | 'kitchen'
  | 'charging';

// ✅ Thêm export MapTool
export type MapTool =
  | 'select'
  | 'pan'
  | 'wall'
  | 'table'
  | 'robotStart'
  | 'waypoint'
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