// src/store/mapStore.ts
import { create } from 'zustand';
import type { GraphEdge, MapObject, MapTool } from '@/types/map';
import type { GraphNode } from '@/types/graph';
import { migrateLegacyMapToGraph } from '@/utils/migrateLegacyGraph';

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
  selectedTool: MapTool;
  selectedObjectId: string | null;
  selectedGraphNodeId: string | null;
  selectedGraphEdgeId: string | null;
  edgeDraftFromNodeId: string | null;
  objects: MapObject[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  zoom: number;
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

const createRobotStartNodeFromObject = (object: MapObject): GraphNode => ({
  id: `robotStart-${object.id}`,
  type: 'robotStart',
  name: object.name || 'Robot Start',
  x: object.x + object.width / 2,
  y: object.y + object.height / 2,
  theta: 0,
});

const syncRobotStartNode = (objects: MapObject[], nodes: GraphNode[]): GraphNode[] => {
  const robotStartObject = objects.find((object) => object.type === 'robotStart');
  if (!robotStartObject) {
    return nodes.filter((node) => node.type !== 'robotStart');
  }

  const robotStartNode = createRobotStartNodeFromObject(robotStartObject);
  const otherNodes = nodes.filter((node) => node.type !== 'robotStart');
  return enforceSingleRobotStartNodes([robotStartNode, ...otherNodes]);
};

const storedObjects = loadObjectsFromStorage();
const storedGraph = loadGraphFromStorage();
const initialLegacyRouteText = loadLegacyRouteText();
const initialObjects: MapObject[] = storedObjects.length > 0
  ? enforceSingleRobotStartObjects(storedObjects)
  : [];
const initialGraphMigration = migrateLegacyMapToGraph(
  initialObjects,
  storedGraph.nodes,
  storedGraph.edges,
  initialLegacyRouteText,
);
const initialGraph = {
  nodes: initialGraphMigration.nodes,
  edges: initialGraphMigration.edges,
};
if (initialGraphMigration.migrated) {
  saveGraphToStorage(initialGraph.nodes, initialGraph.edges);
}

export const useMapStore = create<MapState>((set, get) => ({
  selectedTool: 'select',
  selectedObjectId: 'table-4',
  selectedGraphNodeId: null,
  selectedGraphEdgeId: null,
  edgeDraftFromNodeId: null,
  objects: initialObjects,
  graphNodes: enforceSingleRobotStartNodes(initialGraph.nodes),
  graphEdges: initialGraph.edges,
  zoom: 1,

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

      const nextGraphNodes = object.type === 'robotStart'
        ? syncRobotStartNode(newObjects, state.graphNodes)
        : state.graphNodes;
      if (object.type === 'robotStart') {
        saveGraphToStorage(nextGraphNodes, state.graphEdges);
      }

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

      const nextGraphNodes = syncRobotStartNode(newObjects, state.graphNodes);
      if (newObjects.some((object) => object.type === 'robotStart')) {
        saveGraphToStorage(nextGraphNodes, state.graphEdges);
      }

      return { objects: newObjects, graphNodes: nextGraphNodes };
    }),

  removeObject: (id) =>
    set((state) => {
      const newObjects = state.objects.filter((obj) => obj.id !== id);
      saveObjectsToStorage(newObjects);

      const nextGraphNodes = newObjects.some((object) => object.type === 'robotStart')
        ? syncRobotStartNode(newObjects, state.graphNodes)
        : state.graphNodes.filter((node) => node.type !== 'robotStart');
      saveGraphToStorage(nextGraphNodes, state.graphEdges);

      return {
        objects: newObjects,
        graphNodes: nextGraphNodes,
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
    const resetMigration = migrateLegacyMapToGraph(resetObjects, [], [], '');
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
    const migration = migrateLegacyMapToGraph(nextObjects, graph.nodes, graph.edges, legacyRouteText);
    const nextNodes = enforceSingleRobotStartNodes(migration.nodes);
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
    const migration = migrateLegacyMapToGraph(objects, get().graphNodes, get().graphEdges, loadLegacyRouteText());
    const graphNodes = enforceSingleRobotStartNodes(migration.nodes);
    const graphEdges = migration.edges;
    saveObjectsToStorage(objects);
    saveGraphToStorage(graphNodes, graphEdges);
    set({ objects, graphNodes, graphEdges });
  },
}));
