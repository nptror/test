// src/utils/exportWaypoints.ts
import { GraphNode } from '../types/graph';

/**
 * Export waypoints as plain text.
 * Only functional points are exported: robotStart, kitchen, charging, delivery.
 * Table, wall, chair are not exported.
 */
export function exportWaypoints(nodes: GraphNode[], floorSize: number, resolution: number): string {
  const lines: string[] = [];
  let robotStartExported = false;

  nodes.forEach((node) => {
    if (node.type === 'robotStart') {
      if (robotStartExported) return;
      const name = `RobotStart_${node.id.replace(/\s+/g, '_')}`;
      lines.push(`${name}: ${node.x.toFixed(2)} ${node.y.toFixed(2)}`);
      robotStartExported = true;
    } else if (node.type === 'delivery') {
      const name = (node.name || `Delivery_${node.id}`).replace(/\s+/g, '_');
      lines.push(`${name}: ${node.x.toFixed(2)} ${node.y.toFixed(2)}`);
    } else if (node.type === 'kitchen' || node.type === 'charging') {
      const name = (node.name || `${node.type.charAt(0).toUpperCase() + node.type.slice(1)}_${node.id}`).replace(/\s+/g, '_');
      lines.push(`${name}: ${node.x.toFixed(2)} ${node.y.toFixed(2)}`);
    }
  });

  return lines.join('\n');
}
