// src/utils/exportWaypoints.ts
import { MapObject } from '../types/map';
import { pixelToWorld } from './coordinateUtils';

/**
 * Xuất danh sách waypoint dạng text.
 * CHỈ xuất các điểm chức năng (robotStart, kitchen, charging, delivery).
 * Bàn ăn (table), tường (wall) và ghế (chair) không được xuất hiện trong file này.
 */
export function exportWaypoints(objects: MapObject[], floorSize: number, resolution: number): string {
  const lines: string[] = [];

  objects.forEach((obj) => {
    // Chỉ lấy các điểm chức năng đỗ xe hoặc ghim giao hàng của bàn
    if (obj.type === 'robotStart' || obj.type === 'kitchen' || obj.type === 'charging') {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const world = pixelToWorld(cx, cy, floorSize, resolution);
      const name = `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)}_${obj.id.replace(/\s+/g, '_')}`;
      lines.push(`${name}: ${world.x.toFixed(2)} ${world.y.toFixed(2)}`);
    } 
    else if (obj.type === 'table') {
      let cx = obj.x + obj.width / 2;
      let cy = obj.y + obj.height / 2;
      const angleRad = ((obj.rotation || 0) * Math.PI) / 180;
      const offX = obj.deliveryOffsetX || 0;
      const offY = obj.deliveryOffsetY || 0;
      const rotatedOffX = offX * Math.cos(angleRad) - offY * Math.sin(angleRad);
      const rotatedOffY = offX * Math.sin(angleRad) + offY * Math.cos(angleRad);
      cx += rotatedOffX;
      cy += rotatedOffY;

      const world = pixelToWorld(cx, cy, floorSize, resolution);
      const name = (obj.name || `Table_${obj.id}`).replace(/\s+/g, '_');
      lines.push(`${name}: ${world.x.toFixed(2)} ${world.y.toFixed(2)}`);
    }
  });

  return lines.join('\n');
}