// src/utils/exportPGM.ts
import { MapObject } from '../types/map';
import { getMapPixels } from './coordinateUtils';

const FREE = 255;
const OBSTACLE = 0;

/**
 * Xây dựng occupancy grid từ danh sách object.
 * Object.x, object.y, width, height đang ở pixel.
 */
export function buildOccupancyGrid(objects: MapObject[], floorSize: number, resolution: number): Uint8Array {
  const mapSize = getMapPixels(floorSize, resolution);
  const grid = new Uint8Array(mapSize * mapSize).fill(FREE);

  objects.forEach(obj => {
    if (obj.type === 'wall' || obj.type === 'table' || obj.type === 'kitchen' || obj.type === 'restricted' || obj.type === 'chair') {
      const rotation = obj.rotation || 0;
      if (rotation === 0) {
        const x1 = Math.max(0, Math.floor(obj.x));
        const x2 = Math.min(mapSize - 1, Math.floor(obj.x + obj.width));
        const y1 = Math.max(0, Math.floor(obj.y));
        const y2 = Math.min(mapSize - 1, Math.floor(obj.y + obj.height));

        for (let row = y1; row <= y2; row++) {
          for (let col = x1; col <= x2; col++) {
            grid[row * mapSize + col] = OBSTACLE;
          }
        }
      } else {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const w2 = obj.width / 2;
        const h2 = obj.height / 2;
        const corners = [
          { x: -w2 * cos - -h2 * sin, y: -w2 * sin + -h2 * cos },
          { x: w2 * cos - -h2 * sin, y: w2 * sin + -h2 * cos },
          { x: w2 * cos - h2 * sin, y: w2 * sin + h2 * cos },
          { x: -w2 * cos - h2 * sin, y: -w2 * sin + h2 * cos }
        ].map(p => ({ x: p.x + cx, y: p.y + cy }));

        const xs = corners.map(p => p.x);
        const ys = corners.map(p => p.y);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const maxX = Math.min(mapSize - 1, Math.ceil(Math.max(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxY = Math.min(mapSize - 1, Math.ceil(Math.max(...ys)));

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const rx = dx * cos + dy * sin;
            const ry = -dx * sin + dy * cos;

            if (Math.abs(rx) <= w2 && Math.abs(ry) <= h2) {
              grid[y * mapSize + x] = OBSTACLE;
            }
          }
        }
      }
    }
  });

  return grid;
}

export function exportPGM(objects: MapObject[], floorSize: number, resolution: number): Blob {
  const mapSize = getMapPixels(floorSize, resolution);
  const grid = buildOccupancyGrid(objects, floorSize, resolution);
  const header = `P5\n${mapSize} ${mapSize}\n255\n`;
  const uint8Header = new TextEncoder().encode(header);
  const blob = new Blob([uint8Header, grid as BlobPart], { type: 'image/x-portable-graymap' });
  return blob;
}