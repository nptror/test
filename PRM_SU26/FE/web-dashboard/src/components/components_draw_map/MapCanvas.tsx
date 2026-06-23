import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Tag, Typography } from 'antd';
import {
  BatteryCharging,
  Bot,
  ChefHat,
  DoorOpen,
  MapPin,
  Move,
  ShieldAlert,
  Square,
  Armchair,
} from 'lucide-react';
import type { MapObject, MapObjectType } from '@/types/map';
import { useMapStore } from '@/store/mapStore';
import { Toolbox } from './Toolbox';
import { getMapPixels, worldToPixel } from '@/utils/coordinateUtils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const SNAP_THRESHOLD = 5;

const toolLabels: Record<string, string> = {
  select: 'Select',
  pan: 'Pan',
  table: 'Table',
  chair: 'Chair',
  wall: 'Wall',
  kitchen: 'Kitchen',
  delivery: 'Delivery Point',
  charging: 'Charging Station',
  restricted: 'Restricted Area',
  door: 'Door',
  robotStart: 'Start Position',
};

function getObjectIcon(type: MapObjectType) {
  switch (type) {
    case 'kitchen':
      return <ChefHat size={18} />;
    case 'charging':
      return <BatteryCharging size={18} />;
    case 'restricted':
      return <ShieldAlert size={18} />;
    case 'robotStart':
      return <Bot size={18} />;
    case 'delivery':
      return <MapPin size={18} />;
    case 'door':
      return <DoorOpen size={18} />;
    case 'chair':
      return <Armchair size={18} />;
    case 'wall':
      return <Move size={18} />;
    default:
      return <Square size={18} />;
  }
}

const objectPhysicalSizes: Record<MapObjectType, { width: number; height: number }> = {
  table: { width: 1.2, height: 0.8 }, // 1.2m x 0.8m
  chair: { width: 0.5, height: 0.5 }, // 0.5m x 0.5m
  wall: { width: 2.0, height: 0.2 }, // 2m x 0.2m
  kitchen: { width: 4.0, height: 3.0 }, // 4m x 3m
  delivery: { width: 0.5, height: 0.5 }, // 0.5m x 0.5m
  charging: { width: 0.6, height: 0.4 }, // 0.6m x 0.4m
  restricted: { width: 3.0, height: 2.0 }, // 3m x 2m
  door: { width: 1.0, height: 0.2 }, // 1m x 0.2m
  robotStart: { width: 0.5, height: 0.5 }, // 0.5m x 0.5m
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
      {selected && object.type === 'table' && (
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
    table: '#6c5ce7',
    chair: '#00b894',
    wall: '#2d3436',
    kitchen: '#e17055',
    delivery: '#fdcb6e',
    charging: '#00cec9',
    restricted: '#d63031',
    door: '#0984e3',
    robotStart: '#6c5ce7',
  };
  return colors[type] || '#636e72';
}

let objectCounter = 100;

export function MapCanvas() {
  const objects = useMapStore((s) => s.objects);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);
  const selectedTool = useMapStore((s) => s.selectedTool);
  const zoom = useMapStore((s) => s.zoom);
  const floorSize = useMapStore((s: any) => s.floorSize) || 20;
  const resolution = useMapStore((s: any) => s.resolution) || 0.05;
  const setZoom = useMapStore((s) => s.setZoom);
  const setSelectedObject = useMapStore((s) => s.setSelectedObject);
  const addObject = useMapStore((s) => s.addObject);
  const updateObject = useMapStore((s) => s.updateObject);
  const removeObject = useMapStore((s) => s.removeObject);

  const [robotState, setRobotState] = useState<{ x: number; y: number; theta: number; status: string } | null>(null);
  const [robotPath, setRobotPath] = useState<{ x: number; y: number }[]>([]);

  // Poll robot position + path
  useEffect(() => {
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
    return () => { clearInterval(statusInterval); clearInterval(pathInterval); };
  }, []);

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
      if (dragState.id) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        const obj = objects.find(o => o.id === dragState.id);
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
          updateObject(dragState.id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
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
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeld.current = true;
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
  }, [removeObject]);

  // Click canvas
  // Click canvas
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current || dragState.id) return;
      if (selectedTool === 'select' || selectedTool === 'pan') {
        setSelectedObject(null);
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      let x = (e.clientX - rect.left - pan.x) / zoom;
      let y = (e.clientY - rect.top - pan.y) / zoom;

      const tool = selectedTool as MapObjectType;
      if (objectPhysicalSizes[tool]) {
        objectCounter++;
        const defaultSize = objectPhysicalSizes[tool];
        const widthPx = Math.round(defaultSize.width / resolution);
        const heightPx = Math.round(defaultSize.height / resolution);
        const mapSize = getMapPixels(floorSize, resolution);
        // Clamp tọa độ để object luôn nằm trong khu vực vẽ
        const clampedX = Math.max(0, Math.min(mapSize - widthPx, Math.round(x - widthPx / 2)));
        const clampedY = Math.max(0, Math.min(mapSize - heightPx, Math.round(y - heightPx / 2)));
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
      }
    },
    [selectedTool, zoom, pan, setSelectedObject, addObject, dragState],
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
          {objects.map((obj) => (
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