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
  | 'robotStart';

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
  | 'robotStart';

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