// src/components/components_draw_map/Toolbar.tsx
import { useMapStore } from '../../store/mapStore';
import { exportPGM } from '../../utils/exportPGM';
import { exportWaypoints } from '../../utils/exportWaypoints';
import { validateRoute } from '../../utils/astar';
import { pixelToWorld } from '../../utils/coordinateUtils';

// Không cần import MapStoreState nữa

export const Toolbar = () => {
  // TypeScript tự suy ra state là MapState từ create<MapState>
  const objects = useMapStore((state) => state.objects);
  const floorSize = useMapStore((s: any) => s.floorSize) || 20; // nếu chưa có thì mặc định 20
  const resolution = useMapStore((s: any) => s.resolution) || 0.05;


  const handleExportPGM = () => {
    const blob = exportPGM(objects, floorSize, resolution);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map_nhahang.pgm';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWaypoints = () => {
    const content = exportWaypoints(objects, floorSize, resolution);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waypoints.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateNavigation = () => {
    // Lúc này objects là MapObject[], nên obj được suy ra là MapObject
    const startObj = objects.find((obj) => obj.type === 'robotStart');
    const tables = objects.filter((obj) => obj.type === 'table');
    if (!startObj) {
      alert('Chưa đặt vị trí xuất phát (robotStart)');
      return;
    }
    const startWorld = {
      x: startObj.x + startObj.width / 2,
      y: startObj.y + startObj.height / 2,
    };
    let allValid = true;
    for (const table of tables) {
      let cx = table.x + table.width / 2;
      let cy = table.y + table.height / 2;

      const angleRad = ((table.rotation || 0) * Math.PI) / 180;
      const offX = table.deliveryOffsetX || 0;
      const offY = table.deliveryOffsetY || 0;

      cx += offX * Math.cos(angleRad) - offY * Math.sin(angleRad);
      cy += offX * Math.sin(angleRad) + offY * Math.cos(angleRad);

      const goalWorld = { x: cx, y: cy };

      const result = validateRoute(startWorld, goalWorld, objects, floorSize, resolution);
      if (!result.valid) {
        alert(`Không tìm được đường đến bàn ${table.name || table.id}`);
        allValid = false;
        break;
      }
    }
    if (allValid) {
      alert('✅ Tất cả các bàn đều có đường đi!');
    }
  };

  const handleSendToRobot = async () => {
    const startObj = objects.find((obj) => obj.type === 'robotStart');
    let robot_start_world_x = 0;
    let robot_start_world_y = 0;

    if (startObj) {
      const startPx = startObj.x + startObj.width / 2;
      const startPy = startObj.y + startObj.height / 2;
      const worldPos = pixelToWorld(startPx, startPy, floorSize, resolution);
      robot_start_world_x = worldPos.x;
      robot_start_world_y = worldPos.y;
    }

    // Lấy danh sách waypoint nếu có (bạn có thể thêm store cho waypoints)
    const waypointsText = exportWaypoints(objects, floorSize, resolution);
    const payload = {
      floorSize,
      resolution,
      robot_start_world_x,
      robot_start_world_y,
      objects,
      waypoints: waypointsText, // <--- Đính kèm chuỗi text vào payload
    };
    console.log(">>> [FE LOG] Dữ liệu chuẩn bị gửi lên Server:", {
      floorSize: payload.floorSize,
      resolution: payload.resolution,
      start_x: payload.robot_start_world_x,
      start_y: payload.robot_start_world_y,
      total_objects: payload.objects.length,
      waypoints_text: payload.waypoints // Xem chuỗi text có bị lặp từ không
    });
    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        alert('✅ Dữ liệu đã gửi thành công!');
      } else {
        alert('❌ Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('❌ Không thể kết nối đến server');
    }
  };

  return (
    <div className="toolbar">
      <button onClick={handleExportPGM}>Export PGM</button>
      <button onClick={handleExportWaypoints}>Export Waypoints</button>
      <button onClick={handleValidateNavigation}>Validate Navigation</button>
      <button onClick={handleSendToRobot}>Gửi dữ liệu đến robot</button>
    </div>
  );
};