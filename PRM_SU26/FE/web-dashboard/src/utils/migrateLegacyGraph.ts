import type { MapObject, GraphEdge } from '../types/map';
import type { GraphNode, GraphNodeType } from '../types/graph';
import { pixelToWorld } from './coordinateUtils';

export interface LegacyGraphMigrationResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  migrated: boolean;
  notes: string[];
}

const CANONICAL_NODE_TYPES = new Set<GraphNodeType>(['robotStart', 'table']);

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createGraphNodeFromObject(obj: MapObject, floorSize = 20, resolution = 0.05): GraphNode | null {
  if (!CANONICAL_NODE_TYPES.has(obj.type as GraphNodeType)) return null;

  const fallbackName = obj.name || obj.type;
  let cx = obj.x + obj.width / 2;
  let cy = obj.y + obj.height / 2;
  const graphType = (obj.type === 'table' ? 'delivery' : obj.type) as GraphNodeType;
  const nameBase = (obj.name || obj.type).replace(/\s+/g, '_');

  if (obj.type === 'table') {
    const angleRad = ((obj.rotation || 0) * Math.PI) / 180;
    const offX = obj.deliveryOffsetX || 0;
    const offY = obj.deliveryOffsetY || 0;
    const rotatedOffX = offX * Math.cos(angleRad) - offY * Math.sin(angleRad);
    const rotatedOffY = offX * Math.sin(angleRad) + offY * Math.cos(angleRad);
    cx += rotatedOffX;
    cy += rotatedOffY;
  }

  const worldPos = pixelToWorld(cx, cy, floorSize, resolution);

  return {
    id: obj.type === 'table' ? `delivery-${obj.id}` : obj.id,
    type: graphType,
    name: graphType === 'delivery' ? `${nameBase}_Delivery` : fallbackName,
    x: worldPos.x,
    y: worldPos.y,
    theta: 0,
    tableNumber: obj.tableNumber,
    deliveryOffsetX: obj.deliveryOffsetX,
    deliveryOffsetY: obj.deliveryOffsetY,
  };
}

function parseLegacyWaypointLine(line: string): GraphNode | null {
  const match = line.match(/^([^:]+):\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const rawName = match[1].trim();
  const lowered = normalizeText(rawName);

  if (/^(?:path|pixel path|robot path|route|segment|wp\s*\d+|waypoint\s*\d+|p\s*\d+)$/i.test(rawName)) {
    return null;
  }

  const x = Number.parseFloat(match[2]);
  const y = Number.parseFloat(match[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let type: GraphNodeType = 'waypoint';
  if (lowered.includes('robotstart') || lowered === 'start' || lowered.includes('start position')) {
    type = 'robotStart';
  } else if (lowered.includes('kitchen')) {
    type = 'kitchen';
  } else if (lowered.includes('charging')) {
    type = 'charging';
  } else if (lowered.includes('table')) {
    type = 'delivery';
  }

  return {
    id: `${type}-${slugify(rawName) || 'legacy'}`,
    type,
    name: rawName,
    x,
    y,
    theta: 0,
  };
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const seenIds = new Set<string>();
  const robotStartNodes: GraphNode[] = [];
  const result: GraphNode[] = [];

  for (const node of nodes) {
    if (!node || !node.id) continue;
    if (seenIds.has(node.id)) continue;
    seenIds.add(node.id);
    if (node.type === 'robotStart') {
      robotStartNodes.push(node);
      continue;
    }
    result.push(node);
  }

  if (robotStartNodes.length > 0) {
    result.unshift(robotStartNodes[0]);
  }

  return result;
}

function mergeMissingCanonicalNodes(existing: GraphNode[], canonical: GraphNode[]): { nodes: GraphNode[]; added: number } {
  const next = [...existing];
  let added = 0;

  const hasRobotStart = next.some((node) => node.type === 'robotStart');
  for (const node of canonical) {
    if (node.type === 'robotStart') {
      if (hasRobotStart) continue;
      next.push(node);
      added++;
      continue;
    }

    const exists = next.some((existingNode) => existingNode.id === node.id);
    if (!exists) {
      next.push(node);
      added++;
    }
  }

  return { nodes: dedupeNodes(next), added };
}

function buildEdgesFromLegacySequence(nodes: GraphNode[], legacySequence: GraphNode[]): { edges: GraphEdge[]; added: number } {
  if (legacySequence.length < 2) return { edges: [], added: 0 };

  const byName = new Map<string, GraphNode>();
  for (const node of nodes) {
    byName.set(normalizeText(node.name), node);
    byName.set(node.id.toLowerCase(), node);
  }

  const created: GraphEdge[] = [];
  let edgeCounter = 1;

  for (let i = 0; i < legacySequence.length - 1; i++) {
    const a = byName.get(normalizeText(legacySequence[i].name)) ?? legacySequence[i];
    const b = byName.get(normalizeText(legacySequence[i + 1].name)) ?? legacySequence[i + 1];
    if (!a || !b || a.id === b.id) continue;

    const edgeId = `legacy-edge-${edgeCounter++}`;
    created.push({
      id: edgeId,
      from: a.id,
      to: b.id,
      bidirectional: true,
      weight: Math.hypot(a.x - b.x, a.y - b.y),
    });
  }

  return { edges: created, added: created.length };
}

function mergeEdges(existing: GraphEdge[], additions: GraphEdge[]): GraphEdge[] {
  if (additions.length === 0) return existing;

  const seen = new Set(existing.map((edge) => `${edge.from}->${edge.to}:${edge.bidirectional}`));
  const next = [...existing];

  for (const edge of additions) {
    const key = `${edge.from}->${edge.to}:${edge.bidirectional}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(edge);
  }

  return next;
}

function sortTablesAndAnchors(nodes: GraphNode[]): GraphNode[] {
  const robotStart = nodes.filter((node) => node.type === 'robotStart');
  const deliveries = nodes
    .filter((node) => node.type === 'delivery')
    .sort((a, b) => (a.tableNumber ?? 0) - (b.tableNumber ?? 0) || a.name.localeCompare(b.name));
  const waypoints = nodes.filter((node) => node.type === 'waypoint');

  return [...robotStart.slice(0, 1), ...deliveries, ...waypoints];
}

export function migrateLegacyMapToGraph(
  objects: MapObject[],
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
  legacyRouteText = '',
  floorSize = 20,
  resolution = 0.05,
): LegacyGraphMigrationResult {
  const notes: string[] = [];
  const canonicalNodes = objects
    .map((obj) => createGraphNodeFromObject(obj, floorSize, resolution))
    .filter((node): node is GraphNode => Boolean(node));

  const normalizedExisting = dedupeNodes(graphNodes);
  let nodes = normalizedExisting;
  let edges = [...graphEdges];
  let migrated = false;

  const hasCanonicalCoverage = canonicalNodes.length > 0 && canonicalNodes.every((canonical) => {
    if (canonical.type === 'robotStart') {
      return nodes.some((node) => node.type === 'robotStart');
    }
    return nodes.some((node) => node.id === canonical.id);
  });

  if (!hasCanonicalCoverage) {
    const merged = mergeMissingCanonicalNodes(nodes, canonicalNodes);
    nodes = merged.nodes;
    if (merged.added > 0) {
      migrated = true;
      notes.push(`Added ${merged.added} canonical graph node(s) from existing map objects.`);
    }
  }

  const legacySequence = legacyRouteText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLegacyWaypointLine)
    .filter((node): node is GraphNode => Boolean(node));

  if (legacySequence.length > 0) {
    const mergedLegacy = mergeMissingCanonicalNodes(nodes, legacySequence.filter((node) => node.type !== 'waypoint'));
    nodes = mergedLegacy.nodes;
    if (mergedLegacy.added > 0) {
      migrated = true;
      notes.push(`Imported ${mergedLegacy.added} legacy anchor node(s) from old waypoint data.`);
    }

    const chain = sortTablesAndAnchors(legacySequence).filter((node) => {
      if (node.type === 'waypoint') return true;
      return nodes.some((existing) => existing.id === node.id || normalizeText(existing.name) === normalizeText(node.name));
    });

    const { edges: legacyEdges, added } = buildEdgesFromLegacySequence(nodes, chain);
    if (added > 0) {
      edges = mergeEdges(edges, legacyEdges);
      migrated = true;
      notes.push(`Converted ${added} legacy path segment(s) into graph edges.`);
    }
  }

  const uniqueEdges = mergeEdges([], edges);
  if (uniqueEdges.length !== graphEdges.length) {
    migrated = true;
  }

  return {
    nodes: nodes.length > 0 ? sortTablesAndAnchors(nodes) : [],
    edges: uniqueEdges,
    migrated,
    notes,
  };
}
