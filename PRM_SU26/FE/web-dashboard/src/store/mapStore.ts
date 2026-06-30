import { create } from 'zustand';
import type { GraphEdge, MapObject, MapTool } from '@/types/map';
import type { GraphNode } from '@/types/graph';
import { migrateLegacyMapToGraph } from '@/utils/migrateLegacyGraph';
import { pixelToWorld } from '@/utils/coordinateUtils';

const STORAGE_KEY = 'restaurant_map_objects';
const GRAPH_STORAGE_KEY = 'restaurant_graph_map';
const LEGACY_ROUTE_TEXT_KEYS = [
  'restaurant_legacy_route_text',
  'restaurant_waypoints_text',
  'legacy_waypoints_text',
  'robot_path_text',
];

const STORAGE_KEYS_TO_CLEAR = [STORAGE_KEY, GRAPH_STORAGE_KEY, ...LEGACY_ROUTE_TEXT_KEYS];

interface StoredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface MapState {
  // Persisted identifier of the currently‑selected map (if any)
  selectedMapId: string | null;
  setSelectedMapId: (id: string | null) => void;
  selectedTool: MapTool;
  selectedObjectId: string | null;
  selectedGraphNodeId: string | null;
  selectedGraphEdgeId: string | null;
  edgeDraftFromNodeId: string | null;
  objects: MapObject[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  zoom: number;
  floorSize: number;
  resolution: number;
  setSelectedTool: (tool: MapTool) => void;
  setSelectedObject: (id: string | null) => void;
  setSelectedGraphNode: (id: string | null) => void;
  setSelectedGraphEdge: (id: string | null) => void;
  setEdgeDraftFromNodeId: (id: string | null) => void;
  addObject: (object: MapObject) => void;
  updateObject: (id: string, updates: Partial<MapObject>) => void;
  removeObject: (id: string) => void;
  addGraphNode: (node: GraphNode) => void;
  updateGraphNode: (id: string, updates: Partial<GraphNode>) => void;
  removeGraphNode: (id: string) => void;
  addGraphEdge: (edge: GraphEdge) => void;
  removeGraphEdge: (id: string) => void;
  resetMap: () => void;
  setZoom: (zoom: number) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const loadObjectsFromStorage = (): MapObject[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data) as MapObject[];
  } catch (e) {
    console.warn('Failed to load map from localStorage', e);
  }
  return [];
};

const saveObjectsToStorage = (objects: MapObject[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
  } catch (e) {
    console.warn('Failed to save map to localStorage', e);
  }
};

const loadGraphFromStorage = (): StoredGraph => {
  try {
    const data = localStorage.getItem(GRAPH_STORAGE_KEY);
    if (data) return JSON.parse(data) as StoredGraph;
  } catch (e) {
    console.warn('Failed to load graph from localStorage', e);
  }
  return { nodes: [], edges: [] };
};

const loadSelectedMapId = (): string | null => {
  try {
    const id = localStorage.getItem('selected_map_id');
    return id ? id : null;
  } catch (e) {
    console.warn('Failed to load selected map id', e);
    return null;
  }
};

const loadLegacyRouteText = (): string => {
  try {
    for (const key of LEGACY_ROUTE_TEXT_KEYS) {
      const data = localStorage.getItem(key);
      if (data && data.trim()) return data;
    }
  } catch (e) {
    console.warn('Failed to load legacy route text from localStorage', e);
  }
  return '';
};

const saveGraphToStorage = (nodes: GraphNode[], edges: GraphEdge[]) => {
  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({ nodes, edges }));
  } catch (e) {
    console.warn('Failed to save graph to localStorage', e);
  }
};

const enforceSingleRobotStartObjects = (objects: MapObject[]): MapObject[] => {
  let seen = false;
  return objects.filter((obj) => {
    if (obj.type !== 'robotStart') return true;
    if (seen) return false;
    seen = true;
    return true;
  });
};

const enforceSingleRobotStartNodes = (nodes: GraphNode[]): GraphNode[] => {
  let seen = false;
  return nodes.filter((node) => {
    if (node.type !== 'robotStart') return true;
    if (seen) return false;
    seen = true;
    return true;
  });
};

const createRobotStartNodeFromObject = (object: MapObject, floorSize = 20, resolution = 0.05): GraphNode => {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const worldPos = pixelToWorld(cx, cy, floorSize, resolution);
  return {
    id: `robotStart-${object.id}`,
    type: 'robotStart',
    name: object.name || 'Robot Start',
    x: worldPos.x,
    y: worldPos.y,
    theta: 0,
  };
};

// syncRobotStartNode removed – start node is now only a GraphNode and not synced from objects

const syncGraphStateWithObjects = (objects: MapObject[], nodes: GraphNode[], floorSize = 20, resolution = 0.05) =>
  // No synchronization with robotStart objects – start node is managed solely as a GraphNode
  nodes;

const alignGraphStateWithObjects = (objects: MapObject[], nodes: GraphNode[], floorSize = 20, resolution = 0.05) => {
  const robotSynced = syncGraphStateWithObjects(objects, nodes, floorSize, resolution);
  const deliveryNodes = objects
    .filter((object) => object.type === 'table')
    .map((object) => {
      let cx = object.x + object.width / 2;
      let cy = object.y + object.height / 2;
      const angleRad = ((object.rotation || 0) * Math.PI) / 180;
      const offX = object.deliveryOffsetX || 0;
      const offY = object.deliveryOffsetY || 0;
      const rotatedOffX = offX * Math.cos(angleRad) - offY * Math.sin(angleRad);
      const rotatedOffY = offX * Math.sin(angleRad) + offY * Math.cos(angleRad);
      cx += rotatedOffX;
      cy += rotatedOffY;
      const worldPos = pixelToWorld(cx, cy, floorSize, resolution);

      return {
        id: `delivery-${object.id}`,
        type: 'delivery' as const,
        name: `${object.name || `Table ${object.id}`}_Delivery`,
        x: worldPos.x,
        y: worldPos.y,
        theta: 0,
        tableNumber: object.tableNumber,
        deliveryOffsetX: object.deliveryOffsetX,
        deliveryOffsetY: object.deliveryOffsetY,
      };
    });

  // New: generate kitchen nodes from kitchen objects
  const kitchenNodes = objects
    .filter((object) => object.type === 'kitchen')
    .map((object) => {
      const cx = object.x + object.width / 2;
      const cy = object.y + object.height / 2;
      const worldPos = pixelToWorld(cx, cy, floorSize, resolution);
      return {
        id: `kitchen-${object.id}`,
        type: 'kitchen' as const,
        name: object.name || `Kitchen ${object.id}`,
        x: worldPos.x,
        y: worldPos.y,
        theta: 0,
      };
    });

  // New: generate charging stations from charging objects
  const chargingNodes = objects
    .filter((object) => object.type === 'charging')
    .map((object) => {
      const cx = object.x + object.width / 2;
      const cy = object.y + object.height / 2;
      const worldPos = pixelToWorld(cx, cy, floorSize, resolution);
      return {
        id: `charging-${object.id}`,
        type: 'charging' as const,
        name: object.name || `Charging ${object.id}`,
        x: worldPos.x,
        y: worldPos.y,
        theta: 0,
      };
    });

  // preserved includes: robotStart (synced), waypoints (standalone GraphNodes)
  // Exclude only object-backed node types that get rebuilt from MapObjects each time
  const preserved = robotSynced.filter(
    (node) =>
      node.type !== 'delivery' &&
      node.type !== 'table' &&
      node.type !== 'kitchen' &&
      node.type !== 'charging'
    // 'waypoint' and 'robotStart' are preserved as-is
  );
  const merged = [...preserved, ...deliveryNodes, ...kitchenNodes, ...chargingNodes];
  return enforceSingleRobotStartNodes(merged);
};

/**
 * Remove any legacy waypoint MapObjects that were mistakenly stored before the fix.
 * Waypoints are now exclusively GraphNodes; they should never appear as MapObjects.
 */
const removeLegacyWaypointObjects = (objects: MapObject[]): MapObject[] =>
  objects.filter((obj) => obj.type !== 'waypoint');

const storedObjects = loadObjectsFromStorage();
const storedGraph = loadGraphFromStorage();
const initialLegacyRouteText = loadLegacyRouteText();
const initialObjects: MapObject[] = storedObjects.length > 0
  ? removeLegacyWaypointObjects(enforceSingleRobotStartObjects(storedObjects))
  : [];
const initialGraphMigration = migrateLegacyMapToGraph(
  initialObjects,
  storedGraph.nodes,
  storedGraph.edges,
  initialLegacyRouteText,
  20,
  0.05
);
const initialGraph = {
  nodes: alignGraphStateWithObjects(initialObjects, initialGraphMigration.nodes, 20, 0.05),
  edges: initialGraphMigration.edges,
};
if (initialGraphMigration.migrated || initialGraph.nodes.length !== initialGraphMigration.nodes.length) {
  saveGraphToStorage(initialGraph.nodes, initialGraph.edges);
}

export const useMapStore = create<MapState>((set, get) => ({
  // Selected map identifier (persisted)
  selectedMapId: loadSelectedMapId(),
  setSelectedMapId: (id: string | null) => {
    // Persist to localStorage under a dedicated key
    try {
      if (id === null) {
        localStorage.removeItem('selected_map_id');
      } else {
        localStorage.setItem('selected_map_id', id);
      }
    } catch (e) {
      console.warn('Failed to persist selected map id', e);
    }
    set({ selectedMapId: id });
  },
  selectedTool: 'select',
  selectedObjectId: 'table-4',
  selectedGraphNodeId: null,
  selectedGraphEdgeId: null,
  edgeDraftFromNodeId: null,
  objects: initialObjects,
  graphNodes: enforceSingleRobotStartNodes(initialGraph.nodes),
  graphEdges: initialGraph.edges,
  zoom: 1,
  floorSize: 20,
  resolution: 0.05,

  setSelectedTool: (tool) =>
    set((state) => ({
      selectedTool: tool,
      edgeDraftFromNodeId: tool === 'edge' ? state.edgeDraftFromNodeId : null,
      selectedGraphEdgeId: tool === 'edge' ? state.selectedGraphEdgeId : null,
    })),

  setSelectedObject: (id) => set({ selectedObjectId: id }),
  setSelectedGraphNode: (id) => set({ selectedGraphNodeId: id, selectedGraphEdgeId: null }),
  setSelectedGraphEdge: (id) => set({ selectedGraphEdgeId: id, selectedGraphNodeId: null }),
  setEdgeDraftFromNodeId: (id) => set({ edgeDraftFromNodeId: id }),

  addObject: (object) =>
    set((state) => {
      const nextObjects = object.type === 'robotStart'
        ? [...state.objects.filter((obj) => obj.type !== 'robotStart'), object]
        : [...state.objects, object];
      const newObjects = enforceSingleRobotStartObjects(nextObjects);
      saveObjectsToStorage(newObjects);

      const nextGraphNodes = alignGraphStateWithObjects(newObjects, state.graphNodes, state.floorSize, state.resolution);
      saveGraphToStorage(nextGraphNodes, state.graphEdges);

      return {
        objects: newObjects,
        graphNodes: nextGraphNodes,
        selectedObjectId: object.id,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const nextObjects = state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj));
      const newObjects = enforceSingleRobotStartObjects(nextObjects);
      saveObjectsToStorage(newObjects);

      const nextGraphNodes = alignGraphStateWithObjects(newObjects, state.graphNodes, state.floorSize, state.resolution);
      saveGraphToStorage(nextGraphNodes, state.graphEdges);

      return { objects: newObjects, graphNodes: nextGraphNodes };
    }),

  removeObject: (id) =>
    set((state) => {
      const newObjects = state.objects.filter((obj) => obj.id !== id);
      saveObjectsToStorage(newObjects);

      const nextGraphNodes = alignGraphStateWithObjects(newObjects, state.graphNodes, state.floorSize, state.resolution);
      const deletedNodeIds = [id, `delivery-${id}`, `kitchen-${id}`, `charging-${id}`];
      const nextGraphEdges = state.graphEdges.filter(
        (edge) => !deletedNodeIds.includes(edge.from) && !deletedNodeIds.includes(edge.to)
      );

      saveGraphToStorage(nextGraphNodes, nextGraphEdges);

      return {
        objects: newObjects,
        graphNodes: nextGraphNodes,
        graphEdges: nextGraphEdges,
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      };
    }),

  addGraphNode: (node) =>
    set((state) => {
      const nextNodes = node.type === 'robotStart'
        ? [...state.graphNodes.filter((n) => n.type !== 'robotStart'), node]
        : [...state.graphNodes, node];
      const nodes = enforceSingleRobotStartNodes(nextNodes);
      saveGraphToStorage(nodes, state.graphEdges);
      return {
        graphNodes: nodes,
        selectedGraphNodeId: node.id,
        selectedGraphEdgeId: null,
        edgeDraftFromNodeId: null,
      };
    }),

  updateGraphNode: (id, updates) =>
    set((state) => {
      const nextNodes = state.graphNodes.map((node) => (node.id === id ? { ...node, ...updates } : node));
      const nodes = enforceSingleRobotStartNodes(nextNodes);
      saveGraphToStorage(nodes, state.graphEdges);
      return { graphNodes: nodes };
    }),

  removeGraphNode: (id) =>
    set((state) => {
      const nodes = state.graphNodes.filter((node) => node.id !== id);
      const edges = state.graphEdges.filter((edge) => edge.from !== id && edge.to !== id);
      saveGraphToStorage(nodes, edges);
      return {
        graphNodes: nodes,
        graphEdges: edges,
        selectedGraphNodeId: state.selectedGraphNodeId === id ? null : state.selectedGraphNodeId,
        selectedGraphEdgeId: null,
        edgeDraftFromNodeId: state.edgeDraftFromNodeId === id ? null : state.edgeDraftFromNodeId,
      };
    }),

  addGraphEdge: (edge) =>
    set((state) => {
      const nextEdges = [...state.graphEdges, edge];
      saveGraphToStorage(state.graphNodes, nextEdges);
      return {
        graphEdges: nextEdges,
        selectedGraphEdgeId: edge.id,
        selectedGraphNodeId: null,
        edgeDraftFromNodeId: null,
      };
    }),

  removeGraphEdge: (id) =>
    set((state) => {
      const nextEdges = state.graphEdges.filter((edge) => edge.id !== id);
      saveGraphToStorage(state.graphNodes, nextEdges);
      return {
        graphEdges: nextEdges,
        selectedGraphEdgeId: state.selectedGraphEdgeId === id ? null : state.selectedGraphEdgeId,
      };
    }),

  resetMap: () => {
    try {
      STORAGE_KEYS_TO_CLEAR.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear map storage', e);
    }

    const resetObjects: MapObject[] = [];
    const resetMigration = migrateLegacyMapToGraph(resetObjects, [], [], '', 20, 0.05);
    const resetNodes = enforceSingleRobotStartNodes(resetMigration.nodes);
    const resetEdges = resetMigration.edges;

    saveObjectsToStorage(resetObjects);
    saveGraphToStorage(resetNodes, resetEdges);
    set({
      selectedTool: 'select',
      selectedObjectId: null,
      selectedGraphNodeId: null,
      selectedGraphEdgeId: null,
      edgeDraftFromNodeId: null,
      objects: resetObjects,
      graphNodes: resetNodes,
      graphEdges: resetEdges,
      zoom: 1,
    });
  },

  setZoom: (zoom) => set({ zoom }),

  loadFromStorage: () => {
    const objects = loadObjectsFromStorage();
    const nextObjects = objects.length > 0 ? enforceSingleRobotStartObjects(objects) : [];
    set({ objects: nextObjects });

    const graph = loadGraphFromStorage();
    const legacyRouteText = loadLegacyRouteText();
    const migration = migrateLegacyMapToGraph(nextObjects, graph.nodes, graph.edges, legacyRouteText, get().floorSize, get().resolution);
    const alignedNodes = alignGraphStateWithObjects(nextObjects, migration.nodes, get().floorSize, get().resolution);
    const nextNodes = enforceSingleRobotStartNodes(alignedNodes);
    const nextEdges = migration.edges;

    if (migration.migrated) {
      saveGraphToStorage(nextNodes, nextEdges);
    }

    set({
      graphNodes: nextNodes,
      graphEdges: nextEdges,
    });
  },

  saveToStorage: () => {
    const objects = enforceSingleRobotStartObjects(get().objects);
    const migration = migrateLegacyMapToGraph(objects, get().graphNodes, get().graphEdges, loadLegacyRouteText(), get().floorSize, get().resolution);
    const alignedNodes = alignGraphStateWithObjects(objects, migration.nodes, get().floorSize, get().resolution);
    const graphNodes = enforceSingleRobotStartNodes(alignedNodes);
    const graphEdges = migration.edges;
    saveObjectsToStorage(objects);
    saveGraphToStorage(graphNodes, graphEdges);
    set({ objects, graphNodes, graphEdges });
  },
}));
