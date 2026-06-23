// src/utils/coordinateUtils.ts
export function getMapPixels(floorSize: number, resolution: number): number {
  return Math.floor(floorSize / resolution);
}

export function worldToPixel(wx: number, wy: number, floorSize: number, resolution: number): { x: number; y: number } {
  const mapPixels = getMapPixels(floorSize, resolution);
  const center = mapPixels / 2;
  return {
    x: center + wx / resolution,
    y: center - wy / resolution,
  };
}

export function pixelToWorld(px: number, py: number, floorSize: number, resolution: number): { x: number; y: number } {
  const mapPixels = getMapPixels(floorSize, resolution);
  const center = mapPixels / 2;
  return {
    x: (px - center) * resolution,
    y: (center - py) * resolution,
  };
}

export function clampWorld(wx: number, wy: number, floorSize: number, resolution: number): { x: number; y: number } {
  const mapPixels = getMapPixels(floorSize, resolution);
  const center = mapPixels / 2;
  const worldMax = center * resolution;
  const worldMin = -center * resolution;
  return {
    x: Math.min(worldMax, Math.max(worldMin, wx)),
    y: Math.min(worldMax, Math.max(worldMin, wy)),
  };
}