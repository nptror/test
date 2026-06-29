import { Button, Tooltip } from 'antd';
import {
  Armchair,
  BatteryCharging,
  CircleDot,
  Hand,
  Link2,
  MousePointer2,
  Move,
  Navigation,
  Plus,
  Square,
  Utensils,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MapTool } from '@/types/map';
import { useMapStore } from '@/store/mapStore';

interface ToolDefinition {
  tool: MapTool;
  label: string;
  Icon: LucideIcon;
}

const tools: ToolDefinition[] = [
  { tool: 'select', label: 'Select', Icon: MousePointer2 },
  { tool: 'pan', label: 'Pan', Icon: Hand },
  { tool: 'table', label: 'Table', Icon: Square },
  { tool: 'chair', label: 'Chair', Icon: Armchair },
  { tool: 'kitchen', label: 'Kitchen', Icon: Utensils },
  { tool: 'charging', label: 'Charging Station', Icon: BatteryCharging },
  { tool: 'wall', label: 'Wall', Icon: Move },
  { tool: 'restricted', label: 'Restricted Area', Icon: CircleDot },
  { tool: 'robotStart', label: 'Start Position', Icon: Navigation },
  { tool: 'waypoint', label: 'Waypoint', Icon: Plus },
  { tool: 'edge', label: 'Connect Edge', Icon: Link2 },
];

export function Toolbox() {
  const selectedTool = useMapStore((state) => state.selectedTool);
  const setSelectedTool = useMapStore((state) => state.setSelectedTool);

  return (
    <div className="floating-toolbox" aria-label="Map tools">
      {tools.map(({ tool, label, Icon }) => (
        <Tooltip key={tool} title={label} placement="right">
          <Button
            aria-label={label}
            type={selectedTool === tool ? 'primary' : 'default'}
            icon={<Icon size={18} />}
            onClick={() => setSelectedTool(tool)}
          />
        </Tooltip>
      ))}
    </div>
  );
}
