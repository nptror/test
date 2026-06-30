// map-server/server.js
// Express Map Server with full CRUD, file storage, and WebSocket notifications.
// Stores each map in a per‑map directory under ./data/maps and copies the
// generated files into the Webots controller directory (Phase_3) so the robot
// controller can read them immediately.

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Configuration – controller directory where the robot reads map files
// ---------------------------------------------------------------------------
const WEBOTS_CONTROLLER_DIR = process.env.WEBOTS_CONTROLLER_DIR ||
  'D:/User/PRM/ProjectGroup/test/Robot/controllers/Phase_3';

// ---------------------------------------------------------------------------
// Persistent storage for maps (outside the controller dir)
// ---------------------------------------------------------------------------
const DATA_ROOT = path.resolve(__dirname, 'data', 'maps');
if (!fs.existsSync(DATA_ROOT)) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

// ---------------------------------------------------------------------------
// WebSocket server – notifies robot controller of create / update / delete
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Robot Controller connected via WebSocket');
  ws.send(JSON.stringify({ type: 'connected' }));
});

function broadcastMapUpdated(mapId) {
  const payload = JSON.stringify({ type: 'mapUpdated', mapId });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function validatePayload(payload) {
  const required = [
    'floorSize',
    'resolution',
    'robot_start_world_x',
    'robot_start_world_y',
    'objects',
    'graph',
    'waypoints',
  ];
  for (const key of required) {
    if (!(key in payload)) {
      return `Missing required field: ${key}`;
    }
  }
  if (typeof payload.floorSize !== 'number') return 'floorSize must be a number';
  if (typeof payload.resolution !== 'number') return 'resolution must be a number';
  if (!Array.isArray(payload.objects)) return 'objects must be an array';
  if (typeof payload.graph !== 'string') return 'graph must be a string (JSON)';
  if (typeof payload.waypoints !== 'string') return 'waypoints must be a string';
  return null;
}

// ---------------------------------------------------------------------------
// PGM generation (stub – creates an empty free‑space map)
// ---------------------------------------------------------------------------
function generateEmptyPGM(floorSize, resolution) {
  const width = Math.round(floorSize / resolution);
  const height = width; // square map for simplicity
  const header = `P5\n${width} ${height}\n255\n`;
  const emptyPixels = Buffer.alloc(width * height, 255);
  return Buffer.concat([Buffer.from(header, 'ascii'), emptyPixels]);
}

// ---------------------------------------------------------------------------
// Write all map artefacts for a given mapId
// ---------------------------------------------------------------------------
function writeMapFiles(mapId, payload) {
  const mapDir = path.join(DATA_ROOT, mapId);
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  }

  // 1. Raw graph JSON (string from payload)
  const graphPath = path.join(mapDir, 'map_graph.json');
  fs.writeFileSync(graphPath, payload.graph, 'utf8');

  // 2. Waypoints text
  const waypointsPath = path.join(mapDir, 'waypoints.txt');
  fs.writeFileSync(waypointsPath, payload.waypoints, 'utf8');

  // 3. ROS map.yaml (metadata only)
  const yamlContent = `
image: map.pgm
resolution: ${payload.resolution}
origin: [0.0, 0.0, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
`.trim() + '\n';
  fs.writeFileSync(path.join(mapDir, 'map.yaml'), yamlContent, 'utf8');

  // 4. Placeholder map.pgm (empty map)
  const pgmBuffer = generateEmptyPGM(payload.floorSize, payload.resolution);
  const pgmPath = path.join(mapDir, 'map.pgm');
  fs.writeFileSync(pgmPath, pgmBuffer);

  // 5. Meta for robot start location
  const meta = {
    resolution: payload.resolution,
    floorSize: payload.floorSize,
    robotStart: {
      x: payload.robot_start_world_x,
      y: payload.robot_start_world_y,
    },
    createdAt: new Date().toISOString(),
  };
  const metaPath = path.join(mapDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  // ---------------------------------------------------------------
  // Copy the artefacts into the Webots controller directory so the
  // robot (Phase_3) can read them without extra logic.
  // ---------------------------------------------------------------
  if (!fs.existsSync(WEBOTS_CONTROLLER_DIR)) {
    fs.mkdirSync(WEBOTS_CONTROLLER_DIR, { recursive: true });
  }
  const copy = (src, destName) => {
    fs.copyFileSync(src, path.join(WEBOTS_CONTROLLER_DIR, destName));
  };
  copy(graphPath, 'map_graph.json');
  copy(waypointsPath, 'waypoints.txt');
  copy(path.join(mapDir, 'map.yaml'), 'map.yaml');
  copy(pgmPath, 'map.pgm');
  copy(metaPath, 'map_meta.json');
}

// ---------------------------------------------------------------------------
// CRUD API endpoints
// ---------------------------------------------------------------------------
// Create – upload a new map (full CRUD upload)
app.post('/api/maps', (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8); // short ID for tracing

  // Validate first
  const err = validatePayload(req.body);
  if (err) {
    console.error(`[${requestId}] Validation failed: ${err}`);
    return res.status(400).json({ error: err });
  }

  // Extract summary info
  const { floorSize, resolution, robot_start_world_x, robot_start_world_y, objects, graph, waypoints } = req.body;
  let graphSummary = { nodes: 0, edges: 0 };
  try {
    const parsed = JSON.parse(graph);
    graphSummary.nodes = parsed.nodes?.length || 0;
    graphSummary.edges = parsed.edges?.length || 0;
  } catch (e) {
    graphSummary = { error: 'Invalid JSON' };
  }

  console.log(`[${requestId}] 📥 Map upload received:
  - floorSize: ${floorSize}
  - resolution: ${resolution}
  - robot start: (${robot_start_world_x}, ${robot_start_world_y})
  - objects: ${objects.length}
  - graph: ${graphSummary.nodes} nodes, ${graphSummary.edges} edges
  - waypoints: ${waypoints ? 'present' : 'empty'}`);

  // Optionally log full payload to file for debugging
  if (process.env.DEBUG_FULL_PAYLOAD === 'true') {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logFile = path.join(logDir, `payload-${requestId}.json`);
    fs.writeFileSync(logFile, JSON.stringify(req.body, null, 2));
    console.log(`[${requestId}] Full payload saved to ${logFile}`);
  }

  const mapId = uuidv4();
  try {
    writeMapFiles(mapId, req.body);
    broadcastMapUpdated(mapId);
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Map ${mapId} created in ${duration}ms`);
    return res.status(201).json({ id: mapId, message: 'Map uploaded successfully' });
  } catch (e) {
    console.error(`[${requestId}] ❌ Error:`, e.message);
    return res.status(500).json({ error: 'Failed to store map files' });
  }
});

// List all maps (meta only)
app.get('/api/maps', (req, res) => {
  const ids = fs.readdirSync(DATA_ROOT).filter((name) => {
    return fs.existsSync(path.join(DATA_ROOT, name, 'meta.json'));
  });
  const list = ids.map((id) => {
    const meta = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, id, 'meta.json'), 'utf8'));
    return { id, ...meta };
  });
  res.json(list);
});

// Get single map meta
app.get('/api/maps/:id', (req, res) => {
  const metaPath = path.join(DATA_ROOT, req.params.id, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  res.json({ id: req.params.id, ...meta });
});

// Update (replace) an existing map
app.put('/api/maps/:id', (req, res) => {
  const mapId = req.params.id;
  const mapDir = path.join(DATA_ROOT, mapId);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  const err = validatePayload(req.body);
  if (err) return res.status(400).json({ error: err });
  try {
    writeMapFiles(mapId, req.body);
    // Update "updatedAt" timestamp in meta
    const metaPath = path.join(mapDir, 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    broadcastMapUpdated(mapId);
    res.json({ message: 'Map updated', id: mapId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update map' });
  }
});

// Delete a map
app.delete('/api/maps/:id', (req, res) => {
  const mapDir = path.join(DATA_ROOT, req.params.id);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  try {
    fs.rmSync(mapDir, { recursive: true, force: true });
    broadcastMapUpdated(req.params.id); // optional deletion notice
    res.json({ message: 'Map deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// Serve static files for a map (e.g., download map.yaml, map.pgm, etc.)
app.use('/api/maps/:id/files', (req, res, next) => {
  const mapDir = path.join(DATA_ROOT, req.params.id);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  express.static(mapDir)(req, res, next);
});

// ---------------------------------------------------------------------------
// Legacy robot‑control endpoints (kept unchanged for compatibility)
// ---------------------------------------------------------------------------
app.post('/api/robot/control', (req, res) => {
  try {
    const { command, target, direction } = req.body;
    const commandPath = path.join(WEBOTS_CONTROLLER_DIR, 'command.txt');
    fs.writeFileSync(commandPath, `${command || 'NONE'} ${target || 'NONE'} ${direction || 'NONE'}`);
    console.log(`>>> [SERVER] Command written: ${command || 'NONE'} ${target || 'NONE'} ${direction || 'NONE'}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/robot/status', (req, res) => {
  try {
    const statePath = path.join(WEBOTS_CONTROLLER_DIR, 'robot_state.txt');
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8').trim();
      const parts = data.split(/\s+/);
      if (parts.length >= 6) {
        return res.json({
          x: parseFloat(parts[0]),
          y: parseFloat(parts[1]),
          theta: parseFloat(parts[2]),
          v: parseFloat(parts[3]),
          omega: parseFloat(parts[4]),
          status: parts[5],
        });
      }
    }
  } catch (err) {
    // ignore read errors
  }
  res.json({ x: 0, y: 0, theta: 0, v: 0, omega: 0, status: 'OFFLINE' });
});

app.get('/api/robot/path', (req, res) => {
  try {
    const pathFile = path.join(WEBOTS_CONTROLLER_DIR, 'robot_path.txt');
    if (fs.existsSync(pathFile)) {
      const data = fs.readFileSync(pathFile, 'utf8').trim();
      if (!data || data === 'NONE') return res.json({ path: [] });
      const points = data.split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          if (isFinite(x) && isFinite(y)) return { x, y };
        }
        return null;
      }).filter(p => p !== null);
      return res.json({ path: points });
    }
  } catch (err) { /* ignore */ }
  res.json({ path: [] });
});

// ---------------------------------------------------------------------------
// Start HTTP + WebSocket server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Map Server listening on http://localhost:${PORT}`);
});