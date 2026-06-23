import { Button, Card, Empty, Form, Input, InputNumber, Select, Tabs, Typography } from 'antd';
import type { TabsProps } from 'antd';
import { Trash2 } from 'lucide-react';
import type { MapObject, MapObjectType } from '@/types/map';
import { useMapStore } from '@/store/mapStore';
import { RobotConsole } from './RobotConsole';

const objectTypeOptions: { value: MapObjectType; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'chair', label: 'Chair' },
  { value: 'wall', label: 'Wall' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'delivery', label: 'Delivery Point' },
  { value: 'charging', label: 'Charging Station' },
  { value: 'restricted', label: 'Restricted Area' },
  { value: 'door', label: 'Door' },
  { value: 'robotStart', label: 'Robot Start Position' },
];

interface InspectorFormProps {
  selectedObject?: MapObject;
  onUpdate: (id: string, updates: Partial<MapObject>) => void;
  onDelete: (id: string) => void;
}

function InspectorForm({ selectedObject, onUpdate, onDelete }: InspectorFormProps) {
  if (!selectedObject) {
    return (
      <Card className="panel-card">
        <Empty description="Select an object on the canvas to inspect it." />
      </Card>
    );
  }

  return (
    <Card title="Inspector" className="panel-card" extra={
      <Button
        danger
        size="small"
        icon={<Trash2 size={14} />}
        onClick={() => onDelete(selectedObject.id)}
      >
        Delete
      </Button>
    }>
      <Form
        key={selectedObject.id}
        layout="vertical"
        initialValues={selectedObject}
        onValuesChange={(changedValues: Partial<MapObject>) => onUpdate(selectedObject.id, changedValues)}
      >
        <Form.Item label="Name" name="name">
          <Input />
        </Form.Item>
        <Form.Item label="Type" name="type">
          <Select options={objectTypeOptions} />
        </Form.Item>
        <Form.Item label="Rotation" name="rotation">
          <InputNumber className="full-width-control" min={0} max={360} step={1} />
        </Form.Item>
        <div className="property-grid">
          <Form.Item label="X Position" name="x">
            <InputNumber className="full-width-control" step={1} />
          </Form.Item>
          <Form.Item label="Y Position" name="y">
            <InputNumber className="full-width-control" step={1} />
          </Form.Item>
        </div>
        <div className="property-grid">
          <Form.Item label="Width" name="width">
            <InputNumber className="full-width-control" min={1} step={1} />
          </Form.Item>
          <Form.Item label="Height" name="height">
            <InputNumber className="full-width-control" min={1} step={1} />
          </Form.Item>
        </div>
        <Form.Item label="Table Number" name="tableNumber">
          <InputNumber className="full-width-control" min={1} step={1} />
        </Form.Item>
      </Form>
    </Card>
  );
}

export function PropertyPanel() {
  const objects = useMapStore((s) => s.objects);
  const selectedObjectId = useMapStore((s) => s.selectedObjectId);
  const updateObject = useMapStore((s) => s.updateObject);
  const removeObject = useMapStore((s) => s.removeObject);
  const setSelectedObject = useMapStore((s) => s.setSelectedObject);
  const selectedObject = objects.find((o) => o.id === selectedObjectId);

  const tabItems: TabsProps['items'] = [
    {
      key: 'inspector',
      label: 'Inspector',
      children: <InspectorForm selectedObject={selectedObject} onUpdate={updateObject} onDelete={removeObject} />,
    },
    {
      key: 'console',
      label: 'Robot Console',
      children: <RobotConsole />,
    },
    {
      key: 'layers',
      label: 'Layers',
      children: (
        <Card className="panel-card">
          <div className="layer-list">
            {objects.map((obj) => (
              <div
                key={obj.id}
                className={obj.id === selectedObjectId ? 'layer-row active' : 'layer-row'}
                onClick={() => setSelectedObject(obj.id)}
                style={{ cursor: 'pointer' }}
              >
                <span>{obj.name}</span>
                <Typography.Text type="secondary">{obj.type}</Typography.Text>
              </div>
            ))}
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="property-panel-inner">
      <Card className="project-card">
        <Typography.Text type="secondary">Project Information</Typography.Text>
        <Typography.Title level={5}>Restaurant Navigation Map</Typography.Title>
        <Typography.Text type="secondary">{objects.length} objects in local state</Typography.Text>
      </Card>
      <Tabs defaultActiveKey="inspector" items={tabItems} />
    </div>
  );
}
