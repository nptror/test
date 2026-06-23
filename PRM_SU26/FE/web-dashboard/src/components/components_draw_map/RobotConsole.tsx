// src/components/components_draw_map/RobotConsole.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Circle,
  Home,
  Navigation,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useMapStore } from '../../store/mapStore';

interface Telemetry {
  x: number;
  y: number;
  theta: number;
  v: number;
  omega: number;
  status: string;
}

export const RobotConsole: React.FC = () => {
  const objects = useMapStore((state) => state.objects);
  const tables = objects.filter((obj) => obj.type === 'table');
  const startObj = objects.find((obj) => obj.type === 'robotStart');

  const [selectedTable, setSelectedTable] = useState<string | undefined>(undefined);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    x: 0,
    y: 0,
    theta: 0,
    v: 0,
    omega: 0,
    status: 'OFFLINE',
  });

  // Polling robot state from server
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/robot/status');
        const data = await res.json();
        setTelemetry(data);
      } catch (err) {
        setTelemetry((prev) => ({ ...prev, status: 'OFFLINE' }));
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 150);
    return () => clearInterval(interval);
  }, []);

  const sendControlCommand = async (command: string, target?: string, direction?: string) => {
    try {
      await fetch('http://localhost:3001/api/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, target, direction }),
      });
    } catch (error) {
      console.error('Lỗi gửi lệnh điều khiển:', error);
    }
  };

  const handleNavigate = () => {
    if (selectedTable) {
      sendControlCommand('NAV_TO_TABLE', selectedTable);
    }
  };

  const handleReturnHome = () => {
    sendControlCommand('NAV_TO_TABLE', 'robotStart');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IDLE':
        return 'blue';
      case 'NAV_TO_TABLE':
        return 'green';
      case 'MANUAL_MOVE':
        return 'orange';
      case 'RETURN_TO_KITCHEN':
        return 'gold';
      case 'OFFLINE':
      default:
        return 'red';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'IDLE': return '⏸️ Chờ lệnh';
      case 'NAV_TO_TABLE': return '🚚 Giao hàng';
      case 'MANUAL_MOVE': return '🕹️ Thủ công';
      case 'RETURN_TO_KITCHEN': return '🔄 Calibrating...';
      case 'OFFLINE': return '🔴 Offline';
      default: return status;
    }
  };

  const isCalibrating = telemetry.status === 'RETURN_TO_KITCHEN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Banner cảnh báo khi robot đang calibrating */}
      {isCalibrating && (
        <Alert
          type="warning"
          showIcon
          message="Đang xác định vị trí..."
          description="Robot đang chạy về điểm xuất phát để hiệu chỉnh bản đồ. Vị trí hiển thị trên UI là vị trí GPS thực tế (chấm vàng)."
          style={{ borderRadius: '8px' }}
        />
      )}

      {/* Màn hình trạng thái */}
      <Card title="Robot Telemetry" size="small" className="panel-card">
        <Row justify="space-between" align="middle" style={{ marginBottom: '12px' }}>
          <Typography.Text strong>Trạng thái:</Typography.Text>
          <Tag color={getStatusColor(telemetry.status)} style={{ fontWeight: 'bold' }}>
            {getStatusLabel(telemetry.status)}
          </Tag>
        </Row>
        
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic title="Odom X (m)" value={telemetry.x} precision={2} />
          </Col>
          <Col span={12}>
            <Statistic title="Odom Y (m)" value={telemetry.y} precision={2} />
          </Col>
          <Col span={12}>
            <Statistic title="Vận tốc V (m/s)" value={telemetry.v} precision={2} />
          </Col>
          <Col span={12}>
            <Statistic title="Góc Omega (rad/s)" value={telemetry.omega} precision={2} />
          </Col>
        </Row>
      </Card>

      {/* Bảng chọn bàn giao hàng */}
      <Card title="Giao Hàng Tới Bàn" size="small" className="panel-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            placeholder="Chọn bàn ăn..."
            style={{ width: '100%' }}
            value={selectedTable}
            onChange={setSelectedTable}
            options={tables.map((t) => ({
              value: (t.name || `Table_${t.id}`).replace(/\s+/g, '_'),
              label: t.name || `Table ${t.id}`,
            }))}
          />
          <Row gutter={8}>
            <Col span={12}>
              <Button
                type="primary"
                icon={<Navigation size={14} />}
                onClick={handleNavigate}
                disabled={!selectedTable || telemetry.status === 'OFFLINE'}
                block
              >
                Giao Hàng
              </Button>
            </Col>
            <Col span={12}>
              <Button
                icon={<Home size={14} />}
                onClick={handleReturnHome}
                disabled={telemetry.status === 'OFFLINE'}
                block
              >
                Về Điểm Xuất Phát
              </Button>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* D-Pad Lái Thủ Công */}
      <Card title="Lái Thủ Công (Manual)" size="small" className="panel-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {/* Hàng 1: Tiến */}
          <Button
            type="dashed"
            icon={<ArrowUp size={16} />}
            onMouseDown={() => sendControlCommand('MANUAL_MOVE', undefined, 'FORWARD')}
            onMouseUp={() => sendControlCommand('MANUAL_MOVE', undefined, 'STOP')}
            disabled={telemetry.status === 'OFFLINE'}
            style={{ width: '60px', height: '50px' }}
          />

          {/* Hàng 2: Trái - Dừng - Phải */}
          <Space>
            <Button
              type="dashed"
              icon={<ArrowLeft size={16} />}
              onMouseDown={() => sendControlCommand('MANUAL_MOVE', undefined, 'LEFT')}
              onMouseUp={() => sendControlCommand('MANUAL_MOVE', undefined, 'STOP')}
              disabled={telemetry.status === 'OFFLINE'}
              style={{ width: '60px', height: '50px' }}
            />
            <Button
              danger
              type="primary"
              icon={<Circle size={16} fill="white" />}
              onClick={() => sendControlCommand('STOP')}
              disabled={telemetry.status === 'OFFLINE'}
              style={{ width: '60px', height: '50px' }}
              title="Dừng Khẩn Cấp"
            />
            <Button
              type="dashed"
              icon={<ArrowRight size={16} />}
              onMouseDown={() => sendControlCommand('MANUAL_MOVE', undefined, 'RIGHT')}
              onMouseUp={() => sendControlCommand('MANUAL_MOVE', undefined, 'STOP')}
              disabled={telemetry.status === 'OFFLINE'}
              style={{ width: '60px', height: '50px' }}
            />
          </Space>

          {/* Hàng 3: Lùi */}
          <Button
            type="dashed"
            icon={<ArrowDown size={16} />}
            onMouseDown={() => sendControlCommand('MANUAL_MOVE', undefined, 'BACKWARD')}
            onMouseUp={() => sendControlCommand('MANUAL_MOVE', undefined, 'STOP')}
            disabled={telemetry.status === 'OFFLINE'}
            style={{ width: '60px', height: '50px' }}
          />
        </div>
      </Card>
    </div>
  );
};
