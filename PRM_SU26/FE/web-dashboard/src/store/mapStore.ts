// src/store/mapStore.ts
import { create } from 'zustand';
import type { MapObject, MapTool } from '@/types/map';

// Key lưu trữ trong localStorage
const STORAGE_KEY = 'restaurant_map_objects';

interface MapState {
  selectedTool: MapTool;
  selectedObjectId: string | null;
  objects: MapObject[];
  zoom: number;
  setSelectedTool: (tool: MapTool) => void;
  setSelectedObject: (id: string | null) => void;
  addObject: (object: MapObject) => void;
  updateObject: (id: string, updates: Partial<MapObject>) => void;
  removeObject: (id: string) => void;
  setZoom: (zoom: number) => void;
  // Hàm tải dữ liệu từ localStorage
  loadFromStorage: () => void;
  // Hàm lưu xuống localStorage
  saveToStorage: () => void;
}

// Hàm lấy objects từ localStorage
const loadObjectsFromStorage = (): MapObject[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as MapObject[];
    }
  } catch (e) {
    console.warn('Failed to load map from localStorage', e);
  }
  return [];
};

// Hàm lưu objects vào localStorage
const saveObjectsToStorage = (objects: MapObject[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
  } catch (e) {
    console.warn('Failed to save map to localStorage', e);
  }
};

// Initial objects: ưu tiên load từ localStorage, nếu không có thì dùng mặc định
const initialObjects: MapObject[] = loadObjectsFromStorage().length > 0
  ? loadObjectsFromStorage()
  : [
    {
      id: 'kitchen-1',
      name: 'Kitchen Area',
      type: 'kitchen',
      x: 60,
      y: 70,
      width: 80, // 4m
      height: 60, // 3m
      rotation: 0,
    },
    {
      id: 'table-1',
      name: 'Table 01',
      type: 'table',
      x: 180,
      y: 120,
      width: 24, // 1.2m
      height: 16, // 0.8m
      rotation: 0,
      tableNumber: 1,
    },
    {
      id: 'table-2',
      name: 'Table 02',
      type: 'table',
      x: 240,
      y: 120,
      width: 24, // 1.2m
      height: 16, // 0.8m
      rotation: 0,
      tableNumber: 2,
    },
    {
      id: 'table-4',
      name: 'Table 04',
      type: 'table',
      x: 200,
      y: 200,
      width: 24, // 1.2m
      height: 16, // 0.8m
      rotation: 45,
      tableNumber: 4,
    },
    {
      id: 'restricted-1',
      name: 'Restricted Area',
      type: 'restricted',
      x: 300,
      y: 240,
      width: 60, // 3m
      height: 40, // 2m
      rotation: 0,
    },
    {
      id: 'robot-1',
      name: 'Robot Start',
      type: 'robotStart',
      x: 120,
      y: 240,
      width: 10, // 0.5m
      height: 10, // 0.5m
      rotation: 0,
    },
    {
      id: 'charging-1',
      name: 'Charging Station',
      type: 'charging',
      x: 80,
      y: 240,
      width: 12, // 0.6m
      height: 8, // 0.4m
      rotation: 0,
    },
  ];

export const useMapStore = create<MapState>((set, get) => ({
  selectedTool: 'select',
  selectedObjectId: 'table-4',
  objects: initialObjects,
  zoom: 1,

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  setSelectedObject: (id) => set({ selectedObjectId: id }),

  addObject: (object) =>
    set((state) => {
      const newObjects = [...state.objects, object];
      // Lưu vào localStorage sau khi thêm
      saveObjectsToStorage(newObjects);
      return {
        objects: newObjects,
        selectedObjectId: object.id,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const newObjects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      );
      saveObjectsToStorage(newObjects);
      return { objects: newObjects };
    }),

  removeObject: (id) =>
    set((state) => {
      const newObjects = state.objects.filter((obj) => obj.id !== id);
      saveObjectsToStorage(newObjects);
      return {
        objects: newObjects,
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      };
    }),

  setZoom: (zoom) => set({ zoom }),

  // Hàm tải từ localStorage (có thể gọi khi cần)
  loadFromStorage: () => {
    const objects = loadObjectsFromStorage();
    if (objects.length > 0) {
      set({ objects });
    }
  },

  // Hàm lưu (có thể gọi thủ công)
  saveToStorage: () => {
    const objects = get().objects;
    saveObjectsToStorage(objects);
  },
}));