// server/index.js
// Express server for Map Server with full CRUD operations.
// Handles map upload, storage, retrieval, update, deletion, and notifies
// Robot Controller via WebSocket when a map is created/updated.

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.json({ limit: '10mb' })); // allow large payloads

// Data directory where individual maps are stored
const DATA_ROOT = path.resolve(__dirname, 'data', 'maps');
if (!fs.existsSync(DATA_ROOT)) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

// ------------------- WebSocket setup -------------------
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

// ------------------- Helper Functions -------------------
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
  // Basic type checks (more thorough validation could be added)
  if (typeof payload.floorSize !== 'number') return 'floorSize must be a number';
  if (typeof payload.resolution !== 'number') return 'resolution must be a number';
  if (!Array.isArray(payload.objects)) return 'objects must be an array';
  if (typeof payload.graph !== 'string') return 'graph must be a string (JSON)';
  if (typeof payload.waypoints !== 'string') return 'waypoints must be a string';
  return null; // no error
}

function writeMapFiles(mapId, payload) {
  const mapDir = path.join(DATA_ROOT, mapId);
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  }

  // 1. Save the raw graph JSON string to map_graph.json
  const graphPath = path.join(mapDir, 'map_graph.json');
  fs.writeFileSync(graphPath, payload.graph, 'utf8');

  // 2. Save waypoints txt
  const wpPath = path.join(mapDir, 'waypoints.txt');
  fs.writeFileSync(wpPath, payload.waypoints, 'utf8');

  // 3. Generate map.yaml (ROS map metadata)
  const yamlContent = `
image: map.pgm
resolution: ${payload.resolution}
origin: [0.0, 0.0, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
`; // origin could be customized further
  const yamlPath = path.join(mapDir, 'map.yaml');
  fs.writeFileSync(yamlPath, yamlContent.trim() + '\n', 'utf8');

  // 4. Simulate creation of map.pgm (placeholder binary file)
  const pgmPath = path.join(mapDir, 'map.pgm');
  // Minimal PGM header for an empty map (width & height derived from floorSize/resolution)
  const width = Math.round(payload.floorSize / payload.resolution);
  const height = width; // square map for simplicity
  const header = `P5\n${width} ${height}\n255\n`;
  const emptyPixels = Buffer.alloc(width * height, 255); // all free space
  const pgmData = Buffer.concat([Buffer.from(header, 'ascii'), emptyPixels]);
  fs.writeFileSync(pgmPath, pgmData);
}

// ------------------- CRUD Endpoints -------------------
// Create (POST) - same as upload
app.post('/api/maps', (req, res) => {
  const error = validatePayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const mapId = uuidv4();
  try {
    writeMapFiles(mapId, req.body);
    // Store a meta JSON for quick lookup
    const meta = {
      id: mapId,
      floorSize: req.body.floorSize,
      resolution: req.body.resolution,
      robotStart: {
        x: req.body.robot_start_world_x,
        y: req.body.robot_start_world_y,
      },
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(DATA_ROOT, mapId, 'meta.json'),
      JSON.stringify(meta, null, 2),
      'utf8'
    );
    broadcastMapUpdated(mapId);
    return res.status(201).json({ id: mapId, message: 'Map uploaded successfully' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to store map files' });
  }
});

// Read list (GET /api/maps)
app.get('/api/maps', (req, res) => {
  const ids = fs.readdirSync(DATA_ROOT).filter((name) => {
    const metaPath = path.join(DATA_ROOT, name, 'meta.json');
    return fs.existsSync(metaPath);
  });
  const list = ids.map((id) => {
    const meta = JSON.parse(
      fs.readFileSync(path.join(DATA_ROOT, id, 'meta.json'), 'utf8')
    );
    return meta;
  });
  res.json(list);
});

// Read single map meta (GET /api/maps/:id)
app.get('/api/maps/:id', (req, res) => {
  const mapDir = path.join(DATA_ROOT, req.params.id);
  const metaPath = path.join(mapDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  res.json(meta);
});

// Update (PUT) – replace existing map files
app.put('/api/maps/:id', (req, res) => {
  const mapId = req.params.id;
  const mapDir = path.join(DATA_ROOT, mapId);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  const error = validatePayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    writeMapFiles(mapId, req.body);
    // Update meta
    const metaPath = path.join(mapDir, 'meta.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    meta.floorSize = req.body.floorSize;
    meta.resolution = req.body.resolution;
    meta.robotStart = {
      x: req.body.robot_start_world_x,
      y: req.body.robot_start_world_y,
    };
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    broadcastMapUpdated(mapId);
    res.json({ message: 'Map updated', id: mapId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update map' });
  }
});

// Delete (DELETE) – remove map directory
app.delete('/api/maps/:id', (req, res) => {
  const mapDir = path.join(DATA_ROOT, req.params.id);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  try {
    fs.rmSync(mapDir, { recursive: true, force: true });
    // Notify controllers that the map was removed (optional)
    broadcastMapUpdated(req.params.id);
    res.json({ message: 'Map deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// Serve static files (optional) – allow direct download of yaml/pgm/etc.
app.use('/api/maps/:id/files', (req, res, next) => {
  const mapDir = path.join(DATA_ROOT, req.params.id);
  if (!fs.existsSync(mapDir)) {
    return res.status(404).json({ error: 'Map not found' });
  }
  express.static(mapDir)(req, res, next);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Map Server listening on http://localhost:${PORT}`);
});
