// src/components/components_draw_map/Toolbar.tsx
import { useMemo } from 'react';
import { Alert, Button, Popconfirm } from 'antd';
import { useMapStore } from '../../store/mapStore';
import { exportPGM } from '../../utils/exportPGM';
import { exportWaypoints } from '../../utils/exportWaypoints';
import { exportGraph } from '../../utils/exportGraph';
import { validateRoute } from '../../utils/astar';
import { validateGraph, getGraphValidationSummary } from '../../utils/validateGraph';
import { pixelToWorld } from '../../utils/coordinateUtils';

export const Toolbar = () => {
  const objects = useMapStore((state) => state.objects);
  const graphNodes = useMapStore((state) => state.graphNodes);
  const graphEdges = useMapStore((state) => state.graphEdges);
  const resetMap = useMapStore((state) => state.resetMap);
  const floorSize = useMapStore((s: any) => s.floorSize) || 20;
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
    const content = exportWaypoints(graphNodes, floorSize, resolution);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waypoints.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGraph = () => {
    const content = exportGraph(graphNodes, graphEdges, floorSize, resolution);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const graphValidation = useMemo(() => validateGraph(objects, graphNodes, graphEdges, floorSize, resolution), [objects, graphNodes, graphEdges, floorSize, resolution]);
  const graphValidationSummary = useMemo(() => getGraphValidationSummary(graphValidation), [graphValidation]);

  const handleValidateNavigation = () => {
    const startObj = objects.find((obj) => obj.type === 'robotStart');
    const tables = objects.filter((obj) => obj.type === 'table');
    if (!startObj) {
      window.alert('Chưa đặt vị trí xuất phát (robotStart)');
      return;
    }
    const startWorld = pixelToWorld(
      startObj.x + startObj.width / 2,
      startObj.y + startObj.height / 2,
      floorSize,
      resolution
    );
    let allValid = true;
    for (const table of tables) {
      let cx = table.x + table.width / 2;
      let cy = table.y + table.height / 2;

      const angleRad = ((table.rotation || 0) * Math.PI) / 180;
      const offX = table.deliveryOffsetX || 0;
      const offY = table.deliveryOffsetY || 0;

      cx += offX * Math.cos(angleRad) - offY * Math.sin(angleRad);
      cy += offX * Math.sin(angleRad) + offY * Math.cos(angleRad);

      const goalWorld = pixelToWorld(cx, cy, floorSize, resolution);

      const result = validateRoute(startWorld, goalWorld, objects, floorSize, resolution);
      if (!result.valid) {
        window.alert(`Không tìm được đường đến bàn ${table.name || table.id}`);
        allValid = false;
        break;
      }
    }
    if (allValid) {
      window.alert('✅ Tất cả các bàn đều có đường đi!');
    }
  };

  const handleSendToRobot = async () => {
    // Determine robot start position – prefer a GraphNode `robotStart` if present,
    // otherwise fall back to a MapObject of type `robotStart` (legacy).
    const startNode = graphNodes.find((n) => n.type === 'robotStart');
    const startObj = objects.find((obj) => obj.type === 'robotStart');
    let robot_start_world_x = 0;
    let robot_start_world_y = 0;

    if (startNode) {
      // GraphNode already stores world coordinates directly.
      robot_start_world_x = startNode.x;
      robot_start_world_y = startNode.y;
    } else if (startObj) {
      const startPx = startObj.x + startObj.width / 2;
      const startPy = startObj.y + startObj.height / 2;
      const worldPos = pixelToWorld(startPx, startPy, floorSize, resolution);
      robot_start_world_x = worldPos.x;
      robot_start_world_y = worldPos.y;
    }

    const waypointsText = exportWaypoints(graphNodes, floorSize, resolution);
    const graphText = exportGraph(graphNodes, graphEdges, floorSize, resolution);
    const payload = {
      floorSize,
      resolution,
      robot_start_world_x,
      robot_start_world_y,
      objects,
      graph: graphText,
      waypoints: waypointsText, // <--- Đính kèm chuỗi text vào payload
    };
    console.log(">>> [FE LOG] Dữ liệu chuẩn bị gửi lên Server:", {
      floorSize: payload.floorSize,
      resolution: payload.resolution,
      start_x: payload.robot_start_world_x,
      start_y: payload.robot_start_world_y,
      total_objects: payload.objects.length,
      total_graph_nodes: graphNodes.length,
      total_graph_edges: graphEdges.length,
      waypoints_text: payload.waypoints,
      graph_text: payload.graph
    });
    try {
      const response = await fetch('http://localhost:3001/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let result;
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server responded ${response.status}: ${text}`);
      }
      result = await response.json();
      if (result.id) {
        alert('✅ Dữ liệu đã gửi thành công!');
      } else {
        alert('❌ Lỗi: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      alert('❌ Không thể kết nối đến server');
    }
  };

  return (
    <div className="toolbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={handleExportPGM}>Export PGM</button>
          <button onClick={handleExportWaypoints}>Export Waypoints</button>
          <button onClick={handleExportGraph}>Export Graph</button>
          <button onClick={handleValidateNavigation}>Validate Navigation</button>
          <button onClick={handleSendToRobot}>Gửi dữ liệu đến robot</button>
          <Popconfirm
            title="Reset map?"
            description="Xóa toàn bộ state hiện tại, bao gồm objects, graph nodes, graph edges và dữ liệu lưu local."
            okText="Reset"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={resetMap}
          >
            <Button danger>Reset map</Button>
          </Popconfirm>
        </div>
        <Alert
          showIcon
          type={graphValidation.valid ? 'success' : 'error'}
          message={graphValidation.valid ? 'Graph hợp lệ' : `Graph có ${graphValidationSummary.totalIssues} lỗi`}
          description={
            graphValidation.valid
              ? 'Node, edge, robotStart và đường đi tới table đều hợp lệ.'
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {graphValidation.issues.slice(0, 5).map((issue, index) => (
                    <div key={`${issue.type}-${issue.nodeId || issue.edgeId || index}`}>
                      {issue.message}
                    </div>
                  ))}
                  {graphValidation.issues.length > 5 && (
                    <div>… và {graphValidation.issues.length - 5} lỗi nữa.</div>
                  )}
                </div>
              )
          }
        />
      </div>
    </div>
  );
};