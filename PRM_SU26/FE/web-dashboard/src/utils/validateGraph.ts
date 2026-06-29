import type { GraphEdge, MapObject } from '../types/map';
import type { GraphNode } from '../types/graph';
import { buildOccupancyGrid } from './exportPGM';
import { getMapPixels, worldToPixel } from './coordinateUtils';

type Point = { x: number; y: number };

export type GraphValidationIssueType =
  | 'missing_robot_start'
  | 'duplicate_robot_start'
  | 'node_in_wall'
  | 'edge_intersects_wall'
  | 'table_unreachable';

export interface GraphValidationIssue {
  type: GraphValidationIssueType;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidationResult {
  valid: boolean;
  issues: GraphValidationIssue[];
  robotStartCount: number;
  tableCount: number;
}

function isObstacleCell(grid: Uint8Array, mapSize: number, x: number, y: number): boolean {
  if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) return true;
  return grid[y * mapSize + x] === 0;
}

function sampleSegmentIntersectsObstacle(
  from: Point,
  to: Point,
  grid: Uint8Array,
  mapSize: number,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(from.x + dx * t);
    const y = Math.round(from.y + dy * t);
    if (isObstacleCell(grid, mapSize, x, y)) {
      return true;
    }
  }
  return false;
}

function validateRobotStartUniqueness(robotStarts: GraphNode[], issues: GraphValidationIssue[]) {
  if (robotStarts.length === 0) {
    issues.push({
      type: 'missing_robot_start',
      message: 'Graph must contain exactly one robotStart node, but none was found.',
    });
    return;
  }

  if (robotStarts.length > 1) {
    issues.push({
      type: 'duplicate_robot_start',
      message: `Graph must contain exactly one robotStart node, but found ${robotStarts.length}.`,
    });
  }
}

function buildAdjacency(nodes: GraphNode[], edges: GraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from)?.add(edge.to);
    if (edge.bidirectional) {
      adjacency.get(edge.to)?.add(edge.from);
    }
  }
  return adjacency;
}

function hasPath(startId: string, goalId: string, adjacency: Map<string, Set<string>>): boolean {
  if (startId === goalId) return true;
  const queue: string[] = [startId];
  const seen = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const nextNodes = adjacency.get(current);
    if (!nextNodes) continue;
    for (const next of nextNodes) {
      if (seen.has(next)) continue;
      if (next === goalId) return true;
      seen.add(next);
      queue.push(next);
    }
  }

  return false;
}

function validateReachability(
  robotStarts: GraphNode[],
  tables: GraphNode[],
  deliveries: GraphNode[],
  waypoints: GraphNode[],
  nodes: GraphNode[],
  edges: GraphEdge[],
  issues: GraphValidationIssue[],
) {
  if (robotStarts.length !== 1) return;
  const adjacency = buildAdjacency(nodes, edges);
  const start = robotStarts[0];

  for (const table of tables) {
    if (!hasPath(start.id, table.id, adjacency)) {
      issues.push({
        type: 'table_unreachable',
        nodeId: table.id,
        message: `No graph path from robotStart to table "${table.name}".`,
      });
    }
  }

  for (const delivery of deliveries) {
    if (!hasPath(start.id, delivery.id, adjacency)) {
      issues.push({
        type: 'table_unreachable',
        nodeId: delivery.id,
        message: `No graph path from robotStart to delivery node "${delivery.name}".`,
      });
    }
  }

  for (const waypoint of waypoints) {
    if (!hasPath(start.id, waypoint.id, adjacency)) {
      issues.push({
        type: 'table_unreachable',
        nodeId: waypoint.id,
        message: `No graph path from robotStart to waypoint "${waypoint.name}".`,
      });
    }
  }

  const kitchens = nodes.filter((n) => n.type === 'kitchen');
  for (const kitchen of kitchens) {
    if (!hasPath(start.id, kitchen.id, adjacency)) {
      issues.push({
        type: 'table_unreachable',
        nodeId: kitchen.id,
        message: `No graph path from robotStart to kitchen "${kitchen.name}".`,
      });
    }
  }

  const chargings = nodes.filter((n) => n.type === 'charging');
  for (const charging of chargings) {
    if (!hasPath(start.id, charging.id, adjacency)) {
      issues.push({
        type: 'table_unreachable',
        nodeId: charging.id,
        message: `No graph path from robotStart to charging station "${charging.name}".`,
      });
    }
  }
}

export function validateGraph(
  objects: MapObject[],
  nodes: GraphNode[],
  edges: GraphEdge[],
  floorSize: number,
  resolution: number,
): GraphValidationResult {
  const mapSize = getMapPixels(floorSize, resolution);
  const grid = buildOccupancyGrid(objects, floorSize, resolution);
  const issues: GraphValidationIssue[] = [];

  const robotStarts = nodes.filter((node) => node.type === 'robotStart');
  const tables = nodes.filter((node) => node.type === 'table');
  const deliveries = nodes.filter((node) => node.type === 'delivery');
  const waypoints = nodes.filter((node) => node.type === 'waypoint');
  const nodePixelCache = new Map<string, Point>();

  for (const node of nodes) {
    const px = worldToPixel(node.x, node.y, floorSize, resolution);
    const point = { x: Math.round(px.x), y: Math.round(px.y) };
    nodePixelCache.set(node.id, point);

    if (isObstacleCell(grid, mapSize, point.x, point.y)) {
      issues.push({
        type: 'node_in_wall',
        nodeId: node.id,
        message: `Node "${node.name}" is inside a wall or obstacle.`,
      });
    }
  }

  validateRobotStartUniqueness(robotStarts, issues);

  for (const edge of edges) {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;

    const fromPt = nodePixelCache.get(from.id);
    const toPt = nodePixelCache.get(to.id);
    if (!fromPt || !toPt) continue;

    if (sampleSegmentIntersectsObstacle(fromPt, toPt, grid, mapSize)) {
      issues.push({
        type: 'edge_intersects_wall',
        edgeId: edge.id,
        message: `Edge "${from.name} → ${to.name}" intersects a wall or obstacle.`,
      });
    }
  }

  validateReachability(robotStarts, tables, deliveries, waypoints, nodes, edges, issues);

  return {
    valid: issues.length === 0,
    issues,
    robotStartCount: robotStarts.length,
    tableCount: tables.length + deliveries.length,
  };
}

export function getGraphValidationSummary(result: GraphValidationResult) {
  return {
    totalIssues: result.issues.length,
    nodeIssues: result.issues.filter((issue) => issue.type === 'node_in_wall').length,
    edgeIssues: result.issues.filter((issue) => issue.type === 'edge_intersects_wall').length,
    reachabilityIssues: result.issues.filter((issue) => issue.type === 'table_unreachable').length,
    startIssues: result.issues.filter((issue) => issue.type === 'missing_robot_start' || issue.type === 'duplicate_robot_start').length,
  };
}
