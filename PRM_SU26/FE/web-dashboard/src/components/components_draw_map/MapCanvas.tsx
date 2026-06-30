import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tag, Typography, message } from 'antd';
import {
  Star,
  MapPin,
  Move,
  Package,
  Route,
  Square,
  Table2,
  BatteryCharging,
  Utensils,
} from 'lucide-react';
import type { MapObject, MapObjectType, MapTool } from '@/types/map';
import { useMapStore } from '@/store/mapStore';
import { Toolbox } from './Toolbox';
import { getMapPixels, pixelToWorld, worldToPixel } from '@/utils/coordinateUtils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const SNAP_THRESHOLD = 5;

const toolLabels: Record<MapTool, string> = {
  select: 'Select',
  pan: 'Pan',
  table: 'Table',
    wall: 'Wall',
  robotStart: 'Start Position',
  waypoint: 'Waypoint',
  edge: 'Connect Edge',
};

function getObjectIcon(type: MapObjectType) {
  switch (type) {
    case 'robotStart':
      return <Star size={18} />;
    case 'delivery':
      return <MapPin size={18} />;
    case 'wall':
      return <Move size={18} />;
    default:
      return <Square size={18} />;
  }
}

const objectPhysicalSizes: Partial<Record<MapObjectType, { width: number; height: number }>> = {
  wall: { width: 2.0, height: 0.2 }, // 2m x 0.2m
  table: { width: 1.2, height: 0.8 }, // 1.2m x 0.8m
  chair: { width: 0.5, height: 0.5 }, // chair size
  restricted: { width: 1.0, height: 1.0 }, // restricted area placeholder
  delivery: { width: 0.5, height: 0.5 }, // 0.5m x 0.5m
  robotStart: { width: 0.5, height: 0.5 }, // 0.5m x 0.5m
  // 'waypoint' intentionally omitted: waypoints are GraphNodes, NOT MapObjects
  kitchen: { width: 2.4, height: 2.4 }, // default kitchen size
  charging: { width: 1.0, height: 1.0 }, // default charging station size
};

interface MapObjectShapeProps {
  object: MapObject;
  selected: boolean;
  resolution: number;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string, handle: string) => void;
  onDelete: (id: string) => void;
}

function MapObjectShape({
  object,
  selected,
  resolution,
  onSelect,
  onDragStart,
  onResizeStart,
  onDelete,
}: MapObjectShapeProps) {
  const isWall = object.type === 'wall';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(object.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(object.id);
  };

  return (
    <div
      className={`map-object map-object-${object.type} ${selected ? 'map-object-selected' : ''}`}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        transform: `rotate(${object.rotation || 0}deg)`,
        transformOrigin: 'center center',
        cursor: 'grab',
        userSelect: 'none',
        border: selected ? '2px solid #1890ff' : '1px solid transparent',
        borderRadius: object.type === 'wall' ? '2px' : '4px',
        backgroundColor: getObjectColor(object.type),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '12px',
        color: '#000',
        fontWeight: 'bold',
        pointerEvents: 'auto',
        zIndex: selected ? 10 : 1,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 0) {
          onDragStart(e, object.id);
        }
      }}
    >
      {isWall ? null : getObjectIcon(object.type)}
      <span style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{object.name}</span>

      {/* Hiển thị kích thước mét cho tường */}
      {isWall && (
        <div
          style={{
            position: 'absolute',
            bottom: '-22px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '10px',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {(object.width * resolution).toFixed(1)}m × {(object.height * resolution).toFixed(1)}m
        </div>
      )}

      {/* Điểm giao hàng (Delivery Point) cho bàn */}
      {object.type === 'table' && (
        <div
          className="delivery-point-handle"
          style={{
            position: 'absolute',
            width: '16px',
            height: '16px',
            background: '#ff4d4f', // đỏ
            border: '2px solid white',
            borderRadius: '50%',
            left: `calc(50% - 8px + ${object.deliveryOffsetX || 0}px)`,
            top: `calc(50% - 8px + ${object.deliveryOffsetY || 0}px)`,
            cursor: 'grab',
            zIndex: 30,
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, object.id, 'delivery');
          }}
          title="Điểm giao hàng"
        />
      )}

      {/* Handle xoay – chỉ hiển thị khi chọn và là tường */}
      {selected && isWall && (
        <div
          style={{
            position: 'absolute',
            width: '22px',
            height: '22px',
            background: '#ffaa00',
            border: '2px solid white',
            borderRadius: '50%',
            top: '-32px',
            left: '50%',
            transform: 'translateX(-50%)',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#1b1212ff',
            fontWeight: 'bold',
            zIndex: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, object.id, 'rotate');
          }}
        >
          ⟳
        </div>
      )}

      {/* Resize handles */}
      {selected && (
        <>
          <div
            className="resize-handle resize-handle-tl"
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#1890ff',
              border: '1px solid white',
              borderRadius: '50%',
              top: '-4px',
              left: '-4px',
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, object.id, 'tl');
            }}
          />
          <div
            className="resize-handle resize-handle-tr"
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#1890ff',
              border: '1px solid white',
              borderRadius: '50%',
              top: '-4px',
              right: '-4px',
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, object.id, 'tr');
            }}
          />
          <div
            className="resize-handle resize-handle-bl"
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#1890ff',
              border: '1px solid white',
              borderRadius: '50%',
              bottom: '-4px',
              left: '-4px',
              cursor: 'nesw-resize',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, object.id, 'bl');
            }}
          />
          <div
            className="resize-handle resize-handle-br"
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#1890ff',
              border: '1px solid white',
              borderRadius: '50%',
              bottom: '-4px',
              right: '-4px',
              cursor: 'nwse-resize',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, object.id, 'br');
            }}
          />

          {isWall && (
            <>
              <div
                className="resize-handle resize-handle-top"
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  background: '#1890ff',
                  border: '1px solid white',
                  borderRadius: '50%',
                  top: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  cursor: 'ns-resize',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, object.id, 'top');
                }}
              />
              <div
                className="resize-handle resize-handle-bottom"
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  background: '#1890ff',
                  border: '1px solid white',
                  borderRadius: '50%',
                  bottom: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  cursor: 'ns-resize',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, object.id, 'bottom');
                }}
              />
              <div
                className="resize-handle resize-handle-left"
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  background: '#1890ff',
                  border: '1px solid white',
                  borderRadius: '50%',
                  left: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'ew-resize',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, object.id, 'left');
                }}
              />
              <div
                className="resize-handle resize-handle-right"
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  background: '#1890ff',
                  border: '1px solid white',
                  borderRadius: '50%',
                  right: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'ew-resize',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, object.id, 'right');
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function getObjectColor(type: MapObjectType): string {
  const colors: Record<MapObjectType, string> = {
    wall: '#2d3436',
    table: '#6c5ce7',
    chair: '#fd79a8',
    restricted: '#636e72',
    delivery: '#fdcb6e',
    robotStart: '#6c5ce7',
    waypoint: '#1890ff',
    kitchen: '#e17055',
    charging: '#00cec9',
  };
  return colors[type] || '#636e72';
}

let objectCounter = 100;
let graphNodeCounter = 1;
let graphEdgeCounter = 1;

function canvasToWorldPoint(
  x: number,
  y: number,
  floorSize: number,
  resolution: number,
  panX: number,
  panY: number,
  zoom: number,
) {
  const px = (x - panX) / zoom;
  const py = (y - panY) / zoom;
  return pixelToWorld(px, py, floorSize, resolution);
}


export function MapCanvas() {
  const objects = useMapStore((s) => s.objects);
  const graphNodes = useMapStore((s) => s.graphNodes);
  const graphEdges = useMapStore((s) => s.graphEdges);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);
  const selectedGraphNodeId = useMapStore((s) => s.selectedGraphNodeId);
  const selectedGraphEdgeId = useMapStore((s) => s.selectedGraphEdgeId);
  const edgeDraftFromNodeId = useMapStore((s) => s.edgeDraftFromNodeId);
  const selectedTool = useMapStore((s) => s.selectedTool);
  const zoom = useMapStore((s) => s.zoom);
  const floorSize = useMapStore((s: any) => s.floorSize) || 20;
  const resolution = useMapStore((s: any) => s.resolution) || 0.05;
  const setZoom = useMapStore((s) => s.setZoom);
  const setSelectedObject = useMapStore((s) => s.setSelectedObject);
  const setSelectedGraphNode = useMapStore((s) => s.setSelectedGraphNode);
  const setSelectedGraphEdge = useMapStore((s) => s.setSelectedGraphEdge);
  const setEdgeDraftFromNodeId = useMapStore((s) => s.setEdgeDraftFromNodeId);
  const addObject = useMapStore((s) => s.addObject);
  const updateObject = useMapStore((s) => s.updateObject);
  const removeObject = useMapStore((s) => s.removeObject);
  const addGraphNode = useMapStore((s) => s.addGraphNode);
  const selectedMapId = useMapStore((s) => s.selectedMapId);
  const setSelectedMapId = useMapStore((s) => s.setSelectedMapId);
  const updateGraphNode = useMapStore((s) => s.updateGraphNode);
  const addGraphEdge = useMapStore((s) => s.addGraphEdge);
  const removeGraphNode = useMapStore((s) => s.removeGraphNode);

  const [robotState, setRobotState] = useState<{ x: number; y: number; theta: number; status: string } | null>(null);
  const [robotPath, setRobotPath] = useState<{ x: number; y: number }[]>([]);

  // Determine navigation phase based on robot status and path length
  // Phase1: Path calculation (path received but robot not yet moving)
  // Phase2: Following intermediate waypoints
  // Phase3: Arrival at delivery node
  const navPhase = (() => {
    if (!robotState) return 'Idle';
    const status = robotState.status;
    if (status === 'ARRIVED' || status === 'IDLE') return 'Phase3';
    if (status === 'NAV_TO_TABLE') {
      if (robotPath.length <= 2) return 'Phase1';
      return 'Phase2';
    }
    // Fallback for other statuses (e.g., RETURN_TO_KITCHEN)
    return 'Idle';
  })();
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Poll robot position + path
  useEffect(() => {
    // ---------------------------------------------------------------
    // Poll robot live status + path (unchanged)
    // ---------------------------------------------------------------
    const fetchRobotStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/robot/status');
        const data = await res.json();
        if (data && data.status !== 'OFFLINE') {
          setRobotState(data);
        } else {
          setRobotState(null);
        }
      } catch (err) {
        setRobotState(null);
      }
    };
    const fetchRobotPath = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/robot/path');
        const data = await res.json();
        setRobotPath(data.path || []);
      } catch (err) {
        setRobotPath([]);
      }
    };
    fetchRobotStatus();
    fetchRobotPath();
    const statusInterval = setInterval(fetchRobotStatus, 150);
    const pathInterval = setInterval(fetchRobotPath, 500);

    // ---------------------------------------------------------------
    // Ensure a robotStart graph node exists when map meta provides one.
    // This runs once per component mount and adds the node only if missing.
    // ---------------------------------------------------------------
    const ensureRobotStartNode = async () => {
      // If a robotStart node already exists, nothing to do.
      if (graphNodes.some((n) => n.type === 'robotStart')) return;

      let nodeCreated = false;

      // ① Try persisted selectedMapId first.
      if (selectedMapId) {
        try {
          const metaRes = await fetch(`http://localhost:3001/api/maps/${selectedMapId}`);
          const meta = await metaRes.json();
          if (meta && typeof meta.robotStart?.x === 'number' && typeof meta.robotStart?.y === 'number') {
            addGraphNode({
              id: `robotStart-${Date.now()}`,
              type: 'robotStart',
              name: 'Start',
              x: meta.robotStart.x,
              y: meta.robotStart.y,
              theta: 0,
            });
            message.success('✅ Auto‑created robot start node from persisted map meta');
            nodeCreated = true;
          }
        } catch (e) {
          console.warn('Failed to load robotStart from persisted map id', e);
        }
      }

      // ② Fallback: fetch the list of maps, pick the first one and persist its ID.
      if (!nodeCreated) {
        try {
          const listRes = await fetch('http://localhost:3001/api/maps');
          const list = await listRes.json();
          if (!Array.isArray(list) || list.length === 0) return;
          const mapId = list[0].id;
          // Persist the chosen map ID for future mounts.
          setSelectedMapId(mapId);
          const metaRes = await fetch(`http://localhost:3001/api/maps/${mapId}`);
          const meta = await metaRes.json();
          if (meta && typeof meta.robotStart?.x === 'number' && typeof meta.robotStart?.y === 'number') {
            addGraphNode({
              id: `robotStart-${Date.now()}`,
              type: 'robotStart',
              name: 'Start',
              x: meta.robotStart.x,
              y: meta.robotStart.y,
              theta: 0,
            });
            message.success('✅ Auto‑created robot start node from map meta');
            nodeCreated = true;
          }
        } catch (e) {
          console.warn('Failed to load robotStart from map meta', e);
        }
      }

      // ③ Final fallback: use live robot position if meta is missing.
      if (!nodeCreated) {
        try {
          const statusRes = await fetch('http://localhost:3001/api/robot/status');
          const status = await statusRes.json();
          if (status && status.status !== 'OFFLINE' && typeof status.x === 'number' && typeof status.y === 'number') {
            addGraphNode({
              id: `robotStart-${Date.now()}`,
              type: 'robotStart',
              name: 'Start',
              x: status.x,
              y: status.y,
              theta: 0,
            });
            message.info('ℹ️ Created start node from live robot position (meta missing)');
          }
        } catch (e) {
          console.warn('Failed to fallback to robot status for start node', e);
        }
      }
    };
    ensureRobotStartNode();

    return () => { clearInterval(statusInterval); clearInterval(pathInterval); };
  }, [graphNodes, addGraphNode, selectedMapId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const spaceHeld = useRef(false);

  const [dragState, setDragState] = useState<{
    id: string | null;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    handle: string | null;
    initialRotation: number;
    startAngle: number;
    startDeliveryOffsetX?: number;
    startDeliveryOffsetY?: number;
    nodeStartX?: number;
    nodeStartY?: number;
    kind: 'object' | 'node' | null;
  }>({
    id: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    handle: null,
    initialRotation: 0,
    startAngle: 0,
    startDeliveryOffsetX: 0,
    startDeliveryOffsetY: 0,
    nodeStartX: 0,
    nodeStartY: 0,
    kind: null,
  });

  // Snap cho tường
  const applySnap = useCallback((
    currentObj: MapObject,
    newX: number,
    newY: number,
    newWidth: number,
    newHeight: number,
    handle: string | null
  ): { x: number; y: number; width: number; height: number } => {
    if (currentObj.type !== 'wall') {
      return { x: newX, y: newY, width: newWidth, height: newHeight };
    }

    const otherWalls = objects.filter(o => o.id !== currentObj.id && o.type === 'wall');
    let snappedX = newX;
    let snappedY = newY;
    let snappedW = newWidth;
    let snappedH = newHeight;

    const left = newX;
    const right = newX + newWidth;
    const top = newY;
    const bottom = newY + newHeight;

    for (const wall of otherWalls) {
      const wLeft = wall.x;
      const wRight = wall.x + wall.width;
      const wTop = wall.y;
      const wBottom = wall.y + wall.height;

      // Snap ngang
      if (Math.abs(left - wRight) < SNAP_THRESHOLD) {
        snappedX = wRight;
        if (handle === 'left' || handle === 'tl' || handle === 'bl') {
          snappedW = newWidth + (newX - snappedX);
        }
      } else if (Math.abs(right - wLeft) < SNAP_THRESHOLD) {
        const delta = wLeft - right;
        snappedX = newX + delta;
        if (handle === 'right' || handle === 'tr' || handle === 'br') {
          snappedW = newWidth - delta;
        }
      }

      // Snap dọc
      if (Math.abs(top - wBottom) < SNAP_THRESHOLD) {
        snappedY = wBottom;
        if (handle === 'top' || handle === 'tl' || handle === 'tr') {
          snappedH = newHeight + (newY - snappedY);
        }
      } else if (Math.abs(bottom - wTop) < SNAP_THRESHOLD) {
        const delta = wTop - bottom;
        snappedY = newY + delta;
        if (handle === 'bottom' || handle === 'bl' || handle === 'br') {
          snappedH = newHeight - delta;
        }
      }
    }

    if (snappedW < 10) snappedW = 10;
    if (snappedH < 10) snappedH = 10;
    return { x: snappedX, y: snappedY, width: snappedW, height: snappedH };
  }, [objects]);

  // Zoom theo chuột
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const direction = e.deltaY < 0 ? 1 : -1;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom + direction * ZOOM_STEP).toFixed(2)));
      if (newZoom === zoom) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan, setZoom],
  );

  // Pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld.current) || selectedTool === 'pan') {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    [pan, selectedTool],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;

      if (selectedTool === 'edge' && edgeDraftFromNodeId) {
        setMouseCanvasPos({ x: canvasX, y: canvasY });
      } else if (mouseCanvasPos !== null) {
        setMouseCanvasPos(null);
      }

      if (dragState.id) {
        const obj = objects.find(o => o.id === dragState.id);
        const node = graphNodes.find((n) => n.id === dragState.id);
        if (!obj && !node) return;

        if (dragState.kind === 'node' && node) {
              const pointerWorld = pixelToWorld(canvasX, canvasY, floorSize, resolution);
              const nextX = pointerWorld.x - dragState.offsetX;
              const nextY = pointerWorld.y - dragState.offsetY;
              const anchorX = dragState.nodeStartX ?? node.x;
              const anchorY = dragState.nodeStartY ?? node.y;
              const deltaX = nextX - anchorX;
              const deltaY = nextY - anchorY;
              if (Math.hypot(deltaX, deltaY) < 0.02) return;

              // Update graph node position
              updateGraphNode(dragState.id!, { x: nextX, y: nextY });

              // Sync delivery offset back to the parent table object (if this is a delivery node)
              if (node.type === 'delivery') {
                const objectId = node.id.replace('delivery-', '');
                const parentObj = objects.find((o) => o.id === objectId);
                if (parentObj) {
                  // Table centre in world coordinates
                  const tableCenterWorld = pixelToWorld(
                    parentObj.x + parentObj.width / 2,
                    parentObj.y + parentObj.height / 2,
                    floorSize,
                    resolution,
                  );
                  // Convert world delta to pixel offset used by the object
                  // Adjust offset: X direction is fine, Y direction needs sign inversion because world Y increases upwards.
                  const offsetWorldX = nextX - tableCenterWorld.x;
                  const offsetWorldY = tableCenterWorld.y - nextY; // invert Y sign
                  const offsetPxX = offsetWorldX / resolution;
                  const offsetPxY = offsetWorldY / resolution;
                  updateObject(parentObj.id, {
                    deliveryOffsetX: offsetPxX,
                    deliveryOffsetY: offsetPxY,
                  });
                }
              }

              return;
        }

        if (!obj) return;

        // Xử lý điểm giao hàng
        if (dragState.handle === 'delivery') {
          const dx = canvasX - dragState.startX;
          const dy = canvasY - dragState.startY;
          
          // Chuyển đổi dx, dy theo góc xoay của bàn (để chuột kéo hướng nào, điểm đi hướng đó)
          const angleRad = -((obj.rotation || 0) * Math.PI) / 180;
          const localDx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
          const localDy = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

          updateObject(dragState.id, {
            deliveryOffsetX: (dragState.startDeliveryOffsetX || 0) + localDx,
            deliveryOffsetY: (dragState.startDeliveryOffsetY || 0) + localDy,
          });
          return;
        }

        // Xử lý xoay
        if (dragState.handle === 'rotate') {
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          const dx = canvasX - cx;
          const dy = canvasY - cy;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          angle = Math.round(angle / 5) * 5;
          const deltaAngle = angle - dragState.startAngle;
          let newRotation = dragState.initialRotation + deltaAngle;
          newRotation = ((newRotation % 360) + 360) % 360;
          updateObject(dragState.id, { rotation: newRotation });
          return;
        }

        // Resize
        if (dragState.handle) {
          const dx = canvasX - dragState.startX;
          const dy = canvasY - dragState.startY;
          let newWidth = dragState.startWidth;
          let newHeight = dragState.startHeight;
          let newX = obj.x;
          let newY = obj.y;

          switch (dragState.handle) {
            case 'br':
              newWidth = Math.max(10, dragState.startWidth + dx);
              newHeight = Math.max(10, dragState.startHeight + dy);
              break;
            case 'tl':
              newWidth = Math.max(10, dragState.startWidth - dx);
              newHeight = Math.max(10, dragState.startHeight - dy);
              newX = obj.x + (dragState.startWidth - newWidth);
              newY = obj.y + (dragState.startHeight - newHeight);
              break;
            case 'tr':
              newWidth = Math.max(10, dragState.startWidth + dx);
              newHeight = Math.max(10, dragState.startHeight - dy);
              newY = obj.y + (dragState.startHeight - newHeight);
              break;
            case 'bl':
              newWidth = Math.max(10, dragState.startWidth - dx);
              newHeight = Math.max(10, dragState.startHeight + dy);
              newX = obj.x + (dragState.startWidth - newWidth);
              break;
            case 'top':
              newHeight = Math.max(10, dragState.startHeight - dy);
              newY = obj.y + (dragState.startHeight - newHeight);
              break;
            case 'bottom':
              newHeight = Math.max(10, dragState.startHeight + dy);
              break;
            case 'left':
              newWidth = Math.max(10, dragState.startWidth - dx);
              newX = obj.x + (dragState.startWidth - newWidth);
              break;
            case 'right':
              newWidth = Math.max(10, dragState.startWidth + dx);
              break;
            default:
              break;
          }

          // *** KHÔNG ÁP DỤNG SNAP KHI RESIZE ***
          if (obj.type === 'wall') {
            // Keep position fixed for walls
            updateObject(dragState.id, {
              x: obj.x,
              y: obj.y,
              width: newWidth,
              height: newHeight,
            });
          } else {
            updateObject(dragState.id, {
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            });
          }
        } else {
          // Di chuyển – vẫn áp dụng snap
          const newX = canvasX - dragState.offsetX;
          const newY = canvasY - dragState.offsetY;
          const snapped = applySnap(obj, newX, newY, obj.width, obj.height, null);
          updateObject(dragState.id, { x: snapped.x, y: snapped.y });
        }
        return;
      }

      // Pan canvas
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    },
    [dragState, objects, pan, zoom, updateObject, applySnap],
  );

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setDragState({
      id: null,
      offsetX: 0,
      offsetY: 0,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      handle: null,
      initialRotation: 0,
      startAngle: 0,
      startDeliveryOffsetX: 0,
      startDeliveryOffsetY: 0,
      nodeStartX: 0,
      nodeStartY: 0,
      kind: null,
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeld.current = true;
      }
      if (e.code === 'Escape') {
        setEdgeDraftFromNodeId(null);
        setSelectedObject(null);
        setSelectedGraphNode(null);
        setSelectedGraphEdge(null);
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        const selId = useMapStore.getState().selectedObjectId;
        if (selId) removeObject(selId);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [removeObject, setEdgeDraftFromNodeId, setSelectedObject, setSelectedGraphNode, setSelectedGraphEdge]);

  useEffect(() => {
    graphNodeCounter = Math.max(graphNodeCounter, graphNodes.length + 1);
    graphEdgeCounter = Math.max(graphEdgeCounter, graphEdges.length + 1);
  }, [graphEdges.length, graphNodes.length]);

  // Click canvas
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current || dragState.id) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const worldPoint = canvasToWorldPoint(canvasX, canvasY, floorSize, resolution, pan.x, pan.y, zoom);
      const gridLocalX = (canvasX - pan.x) / zoom;
      const gridLocalY = (canvasY - pan.y) / zoom;

      if (selectedTool === 'select' || selectedTool === 'pan') {
        setSelectedObject(null);
        setSelectedGraphNode(null);
        setSelectedGraphEdge(null);
        setEdgeDraftFromNodeId(null);
        return;
      }

      const tool = selectedTool as MapObjectType;
      if (tool !== 'robotStart' && tool !== 'waypoint' && objectPhysicalSizes[tool]) {
        objectCounter++;
        const defaultSize = objectPhysicalSizes[tool];
        const widthPx = Math.round(defaultSize.width / resolution);
        const heightPx = Math.round(defaultSize.height / resolution);
        const mapSize = getMapPixels(floorSize, resolution);
        const clampedX = Math.max(0, Math.min(mapSize - widthPx, Math.round(gridLocalX - widthPx / 2)));
        const clampedY = Math.max(0, Math.min(mapSize - heightPx, Math.round(gridLocalY - heightPx / 2)));
        const newObj: MapObject = {
          id: `${tool}-${objectCounter}`,
          type: tool,
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${objectCounter}`,
          x: clampedX,
          y: clampedY,
          width: widthPx,
          height: heightPx,
          rotation: 0,
        };
        if (tool === 'table') {
          newObj.tableNumber = objectCounter;
          newObj.deliveryOffsetX = 0;
          newObj.deliveryOffsetY = 30;
        }
        addObject(newObj);
        return;
      }

      if (selectedTool === 'waypoint') {
        graphNodeCounter++;
        const nodeType = 'waypoint';
        const nodeId = `${nodeType}-${graphNodeCounter}`;
        const nodeName = `WP ${graphNodeCounter}`;
        addGraphNode({
          id: nodeId,
          type: nodeType,
          name: nodeName,
          x: worldPoint.x,
          y: worldPoint.y,
          theta: 0,
        });
        return;
      }

      if (selectedTool === 'robotStart') {
        // Create a robot start node (green star) without an associated object
        graphNodeCounter++;
        const nodeId = `robotStart-${graphNodeCounter}`;
        addGraphNode({
          id: nodeId,
          type: 'robotStart',
          name: 'Start',
          x: worldPoint.x,
          y: worldPoint.y,
          theta: 0,
        });
        return;
      }

      if (selectedTool === 'edge') {
        const nodeUnderCursor = graphNodes.find((node) => {
          const p = worldToPixel(node.x, node.y, floorSize, resolution);
          return Math.hypot(p.x - canvasX, p.y - canvasY) <= 24;
        });
        if (!nodeUnderCursor) {
          setEdgeDraftFromNodeId(null);
          return;
        }

        if (!edgeDraftFromNodeId) {
          setEdgeDraftFromNodeId(nodeUnderCursor.id);
          setSelectedGraphNode(nodeUnderCursor.id);
          return;
        }

        if (edgeDraftFromNodeId === nodeUnderCursor.id) {
          setEdgeDraftFromNodeId(null);
          return;
        }

        graphEdgeCounter++;
        addGraphEdge({
          id: `edge-${graphEdgeCounter}`,
          from: edgeDraftFromNodeId,
          to: nodeUnderCursor.id,
          bidirectional: true,
          weight: Math.hypot(
            nodeUnderCursor.x - (graphNodes.find((n) => n.id === edgeDraftFromNodeId)?.x || 0),
            nodeUnderCursor.y - (graphNodes.find((n) => n.id === edgeDraftFromNodeId)?.y || 0),
          ),
        });
      }
    },
    [
      addGraphEdge,
      addGraphNode,
      dragState,
      edgeDraftFromNodeId,
      floorSize,
      graphNodes,
      objects,
      pan.x,
      pan.y,
      resolution,
      selectedTool,
      setEdgeDraftFromNodeId,
      setSelectedGraphEdge,
      setSelectedGraphNode,
      setSelectedObject,
      updateGraphNode,
      addObject,
      updateObject,
      zoom,
    ],
  );
  const handleObjectDragStart = useCallback(
    (e: React.PointerEvent, id: string) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      const obj = objects.find(o => o.id === id);
      if (!obj) return;
      setDragState({
        id,
        offsetX: canvasX - obj.x,
        offsetY: canvasY - obj.y,
        startX: canvasX,
        startY: canvasY,
        startWidth: obj.width,
        startHeight: obj.height,
        handle: null,
        initialRotation: obj.rotation || 0,
        startAngle: 0,
        startDeliveryOffsetX: obj.deliveryOffsetX || 0,
        startDeliveryOffsetY: obj.deliveryOffsetY || 0,
        kind: 'object',
      });
      e.preventDefault();
    },
    [objects, pan, zoom, selectedTool],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, id: string, handle: string) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      const obj = objects.find(o => o.id === id);
      if (!obj) return;

      // Nếu xoay
      if (handle === 'rotate') {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        const angle = Math.atan2(canvasY - cy, canvasX - cx) * (180 / Math.PI);
        setDragState({
          id,
          offsetX: 0,
          offsetY: 0,
          startX: 0,
          startY: 0,
          startWidth: obj.width,
          startHeight: obj.height,
          handle: 'rotate',
          initialRotation: obj.rotation || 0,
          startAngle: Math.round(angle / 5) * 5,
          kind: 'object',
        });
        e.preventDefault();
        return;
      }

      // Resize thường
      setDragState({
        id,
        offsetX: 0,
        offsetY: 0,
        startX: canvasX,
        startY: canvasY,
        startWidth: obj.width,
        startHeight: obj.height,
        handle,
        initialRotation: obj.rotation || 0,
        startAngle: 0,
        startDeliveryOffsetX: obj.deliveryOffsetX || 0,
        startDeliveryOffsetY: obj.deliveryOffsetY || 0,
        kind: 'object',
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [objects, pan, zoom, selectedTool],
  );

  const cursorClass =
    selectedTool === 'pan' || spaceHeld.current
      ? 'canvas-cursor-grab'
      : selectedTool === 'select'
        ? 'canvas-cursor-default'
        : 'canvas-cursor-crosshair';

  return (
    <div className="map-canvas-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbox />
      <div className="canvas-status" style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Typography.Text strong>Canvas</Typography.Text>
        <Tag color="blue">{toolLabels[selectedTool]}</Tag>
        <Tag>{Math.round(zoom * 100)}%</Tag>
            <Tag>{navPhase}</Tag>
        {selectedTool === 'edge' && edgeDraftFromNodeId && <Tag color="orange">Edge from {edgeDraftFromNodeId}</Tag>}
        {dragState.id && <Tag color="green">Dragging</Tag>}
      </div>
      <div
        ref={containerRef}
        className={`map-canvas-viewport ${cursorClass}`}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: '#f0f0f0',
          cursor: selectedTool === 'pan' ? 'grab' : 'default',
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleCanvasClick}
      >
        <div
          className="map-canvas-grid"
          style={{
            position: 'relative',
            width: getMapPixels(floorSize, resolution),
            height: getMapPixels(floorSize, resolution),
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundImage: 'radial-gradient(circle, #d0d0d0 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)',
          }}
        >
          {graphEdges.map((edge) => {
            const from = graphNodes.find((node) => node.id === edge.from);
            const to = graphNodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const fromPx = worldToPixel(from.x, from.y, floorSize, resolution);
            const toPx = worldToPixel(to.x, to.y, floorSize, resolution);
            const isSelected = selectedGraphEdgeId === edge.id;
            return (
              <svg
                key={edge.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill={isSelected ? '#52c41a' : '#666'} />
                  </marker>
                </defs>
                <line
                  x1={fromPx.x}
                  y1={fromPx.y}
                  x2={toPx.x}
                  y2={toPx.y}
                  stroke={isSelected ? '#52c41a' : '#666'}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeDasharray={edge.bidirectional ? '0' : '8 5'}
                  markerEnd={edge.bidirectional ? undefined : 'url(#arrowhead)'}
                  opacity={0.85}
                />
              </svg>
            );
          })}

          {/* Active edge draft line following mouse */}
          {selectedTool === 'edge' && edgeDraftFromNodeId && mouseCanvasPos && (() => {
            const fromNode = graphNodes.find(n => n.id === edgeDraftFromNodeId);
            if (!fromNode) return null;
            const fromPx = worldToPixel(fromNode.x, fromNode.y, floorSize, resolution);
            return (
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 25,
                }}
              >
                <line
                  x1={fromPx.x}
                  y1={fromPx.y}
                  x2={mouseCanvasPos.x}
                  y2={mouseCanvasPos.y}
                  stroke="#ff9f43"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  opacity={0.85}
                />
                <circle
                  cx={mouseCanvasPos.x}
                  cy={mouseCanvasPos.y}
                  r={4}
                  fill="#ff9f43"
                />
              </svg>
            );
          })()}

          {graphNodes.map((node) => {
            const isSelected = selectedGraphNodeId === node.id;
            const pos = worldToPixel(node.x, node.y, floorSize, resolution);
            const nodeColor =
              node.type === 'robotStart'
                ? '#52c41a'
                : node.type === 'table'
                  ? '#6c5ce7'
                  : node.type === 'delivery'
                    ? '#ff4d4f'
                    : node.type === 'kitchen'
                      ? '#e17055'
                      : node.type === 'charging'
                        ? '#00cec9'
                        : '#1890ff';
                    // Highlight waypoint during Phase2 navigation
                    let displayColor = nodeColor;
                    if (navPhase === 'Phase2' && node.type === 'waypoint') {
                      displayColor = '#f1c40f'; // bright yellow
                    }

            const nodeIcon =
              node.type === 'robotStart'
                ? <Star size={12} color="white" />
                : node.type === 'table'
                  ? <Table2 size={12} color="white" />
                  : node.type === 'delivery'
                    ? <Package size={12} color="white" />
                    : node.type === 'kitchen'
                      ? <Utensils size={12} color="white" />
                      : node.type === 'charging'
                        ? <BatteryCharging size={12} color="white" />
                        : <Route size={12} color="white" />;

            return (
              <div
                key={node.id}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (selectedTool === 'edge') {
                    if (!edgeDraftFromNodeId) {
                      setEdgeDraftFromNodeId(node.id);
                      setSelectedGraphNode(node.id);
                    } else if (edgeDraftFromNodeId !== node.id) {
                      graphEdgeCounter++;
                      const from = graphNodes.find((n) => n.id === edgeDraftFromNodeId);
                      const weight = from ? Math.hypot(node.x - from.x, node.y - from.y) : 1;
                      addGraphEdge({
                        id: `edge-${graphEdgeCounter}`,
                        from: edgeDraftFromNodeId,
                        to: node.id,
                        bidirectional: true,
                        weight,
                      });
                      setEdgeDraftFromNodeId(null);
                    } else {
                      // Click lại chính node đang chọn → huỷ draft
                      setEdgeDraftFromNodeId(null);
                    }
                    return;
                  }
                  setSelectedGraphNode(node.id);
                  setSelectedObject(null);
                }}
                onPointerDown={(ev) => {
                  if (ev.button !== 0) return;
                  // Khi đang ở chế độ edge, không bắt drag – để onClick xử lý kết nối
                  if (selectedTool === 'edge') return;
                  ev.stopPropagation();
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const canvasX = (ev.clientX - rect.left - pan.x) / zoom;
                  const canvasY = (ev.clientY - rect.top - pan.y) / zoom;
                  const pointerWorld = pixelToWorld(canvasX, canvasY, floorSize, resolution);
                  setDragState({
                    id: node.id,
                    offsetX: pointerWorld.x - node.x,
                    offsetY: pointerWorld.y - node.y,
                    startX: canvasX,
                    startY: canvasY,
                    startWidth: 0,
                    startHeight: 0,
                    handle: null,
                    initialRotation: 0,
                    startAngle: 0,
                    startDeliveryOffsetX: 0,
                    startDeliveryOffsetY: 0,
                    nodeStartX: node.x,
                    nodeStartY: node.y,
                    kind: 'node',
                  });
                  setSelectedGraphNode(node.id);
                  setSelectedObject(null);
                  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                }}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  removeGraphNode(node.id);
                }}
                style={{
                  position: 'absolute',
                  left: pos.x - 10,
                  top: pos.y - 10,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: displayColor,
                  border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.85)',
                  boxShadow: isSelected
                    ? `0 0 0 4px ${displayColor}44, 0 4px 12px rgba(0,0,0,0.25)`
                    : hoveredNodeId === node.id
                      ? `0 0 0 3px ${displayColor}22, 0 2px 8px rgba(0,0,0,0.2)`
                      : '0 1px 4px rgba(0,0,0,0.15)',
                  zIndex: 90,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: node.type === 'waypoint' ? 'grab' : 'pointer',
                  transform: hoveredNodeId === node.id || isSelected ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
                }}
                title={`${node.name} (${node.type})`}
              >
                {nodeIcon}
                <span
                  style={{
                    position: 'absolute',
                    top: '22px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#1f1f1f',
                    whiteSpace: 'nowrap',
                    background: 'rgba(255,255,255,0.9)',
                    padding: '0 4px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }}
                >
                  {node.type === 'robotStart'
                    ? 'Start'
                    : node.type === 'table'
                      ? node.name
                      : node.type === 'delivery'
                        ? 'Delivery'
                        : node.type === 'kitchen'
                          ? 'Kitchen'
                          : node.type === 'charging'
                            ? 'Charging'
                            : 'Waypoint'}
                </span>
              </div>
            );
          })}

          {objects
            .filter((obj) => obj.type !== 'robotStart')
            .map((obj) => (
              <MapObjectShape
                key={obj.id}
                object={obj}
                selected={selectedObjectId === obj.id}
                resolution={resolution}
                onSelect={setSelectedObject}
                onDragStart={handleObjectDragStart}
                onResizeStart={handleResizeStart}
                onDelete={removeObject}
              />
            ))}

          {/* Vẽ đường đi A* planned path */}
          {robotPath.length >= 2 && (() => {
            const mapSize = getMapPixels(floorSize, resolution);
            const points = robotPath.map(p => {
              const px = worldToPixel(p.x, p.y, floorSize, resolution);
              return `${px.x},${px.y}`;
            }).join(' ');
            const dest = robotPath[robotPath.length - 1];
            const destPx = worldToPixel(dest.x, dest.y, floorSize, resolution);
            return (
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: mapSize,
                  height: mapSize,
                  pointerEvents: 'none',
                  zIndex: 50,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#666" />
                  </marker>
                </defs>
                <polyline
                  points={points}
                  fill="none"
                  stroke="#ff4444"
                  strokeWidth="3"
                  strokeDasharray="10,5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
                <circle
                  cx={destPx.x}
                  cy={destPx.y}
                  r="8"
                  fill="#ff4444"
                  stroke="white"
                  strokeWidth="2.5"
                  opacity="0.9"
                />
                <circle
                  cx={destPx.x}
                  cy={destPx.y}
                  r="3"
                  fill="white"
                />
              </svg>
            );
          })()}

          {/* Vẽ Robot trên Canvas – chỉ từ GPS thực tế */}
          {robotState && (() => {
            const isCalibrating = robotState.status === 'RETURN_TO_KITCHEN';
            const robotColor = isCalibrating ? '#f39c12' : '#2ecc71';
            const glowColor = isCalibrating
              ? 'rgba(243, 156, 18, 0.8)'
              : 'rgba(46, 204, 113, 0.8)';
            const pos = worldToPixel(robotState.x, robotState.y, floorSize, resolution);
            return (
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  background: robotColor,
                  border: '3px solid white',
                  borderRadius: '50%',
                  left: pos.x - 14,
                  top: pos.y - 14,
                  zIndex: 100,
                  boxShadow: `0 0 14px ${glowColor}`,
                  transform: `rotate(${((robotState.theta || 0) * 180) / Math.PI}deg)`,
                  transformOrigin: 'center center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'left 0.15s linear, top 0.15s linear, transform 0.15s linear',
                  animation: isCalibrating ? 'robotPulse 1s ease-in-out infinite' : undefined,
                }}
                title={
                  isCalibrating
                    ? `🔄 Đang về điểm xuất phát... (${robotState.x.toFixed(2)}, ${robotState.y.toFixed(2)})`
                    : `🤖 Robot: (${robotState.x.toFixed(2)}, ${robotState.y.toFixed(2)})`
                }
              >
                <div
                  style={{
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: '10px solid #ffffff',
                    transform: 'translateY(-2px)',
                  }}
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}