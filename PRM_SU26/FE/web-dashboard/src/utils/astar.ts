// src/utils/astar.ts
import { MapObject } from '../types/map';
import { buildOccupancyGrid } from './exportPGM';
import { getMapPixels, worldToPixel, pixelToWorld } from './coordinateUtils';

type Point = { x: number; y: number };

function heuristic(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getNeighbors(p: Point, grid: Uint8Array, mapSize: number): Point[] {
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  const result: Point[] = [];
  for (const [dx, dy] of dirs) {
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (nx >= 0 && nx < mapSize && ny >= 0 && ny < mapSize) {
      const idx = ny * mapSize + nx;
      if (grid[idx] !== 0) { // 0 là obstacle
        result.push({ x: nx, y: ny });
      }
    }
  }
  return result;
}

export function findPath(
  startWorld: Point,
  goalWorld: Point,
  objects: MapObject[],
  floorSize: number,
  resolution: number
): Point[] | null {
  const mapSize = getMapPixels(floorSize, resolution);
  const grid = buildOccupancyGrid(objects, floorSize, resolution);
  // Chuyển world -> pixel (làm tròn)
  const startPx = worldToPixel(startWorld.x, startWorld.y, floorSize, resolution);
  const goalPx = worldToPixel(goalWorld.x, goalWorld.y, floorSize, resolution);
  const start = { x: Math.round(startPx.x), y: Math.round(startPx.y) };
  const goal = { x: Math.round(goalPx.x), y: Math.round(goalPx.y) };

  // Kiểm tra start/goal có nằm trong obstacle không (nếu có -> tìm ô trống gần nhất)
  // (Bỏ qua phần này để đơn giản, có thể thêm sau)

  const openSet: Point[] = [start];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const key = (p: Point) => `${p.x},${p.y}`;
  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));

  while (openSet.length > 0) {
    // Tìm node có f nhỏ nhất
    let current = openSet[0];
    let currentIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      const f = fScore.get(key(openSet[i])) ?? Infinity;
      const curF = fScore.get(key(current)) ?? Infinity;
      if (f < curF) {
        current = openSet[i];
        currentIdx = i;
      }
    }
    openSet.splice(currentIdx, 1);

    if (current.x === goal.x && current.y === goal.y) {
      // Xây dựng đường đi
      const path: Point[] = [];
      let cur: Point | undefined = current;
      while (cur) {
        path.push(cur);
        cur = cameFrom.get(key(cur));
      }
      path.reverse();
      // Chuyển pixel -> world
      return path.map(p => pixelToWorld(p.x, p.y, floorSize, resolution));
    }

    for (const neighbor of getNeighbors(current, grid, mapSize)) {
      const tentativeG = (gScore.get(key(current)) ?? 0) + heuristic(current, neighbor);
      if (tentativeG < (gScore.get(key(neighbor)) ?? Infinity)) {
        cameFrom.set(key(neighbor), current);
        gScore.set(key(neighbor), tentativeG);
        fScore.set(key(neighbor), tentativeG + heuristic(neighbor, goal));
        if (!openSet.some(p => p.x === neighbor.x && p.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return null; // Không tìm thấy đường
}

export function validateRoute(
  startWorld: Point,
  goalWorld: Point,
  objects: MapObject[],
  floorSize: number,
  resolution: number
): { valid: boolean; path: Point[] | null } {
  const path = findPath(startWorld, goalWorld, objects, floorSize, resolution);
  return { valid: path !== null, path };
}