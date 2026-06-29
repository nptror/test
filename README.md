# Restaurant Service Robot Map System

## Overview

This repository contains a **Map Server** (Node.js/Express) and a **Robot Controller** (Python) that work together to store map data created in the frontend, make it available to the robot, and broadcast updates.

- **Map Server** provides full CRUD (Create, Read, Update, Delete) for map resources via a REST API.
- Uploaded maps are saved as a collection of files (`map_graph.json`, `waypoints.txt`, `map.yaml`, `map.pgm`).
- A WebSocket endpoint notifies the robot controller whenever a map is created, updated, or deleted.
- **Robot Controller** connects to the WebSocket, reads the files, parses waypoints, and logs the update. In a real robot you would publish ROS/MoveBase topics here.

## Directory Layout

```
.
├── server/                 # Map Server implementation
│   ├── index.js           # Express app with CRUD & WS
│   ├── package.json       # npm dependencies
│   └── data/maps/         # Runtime storage (generated at runtime)
├── robot_controller/       # Simple Python controller
│   └── controller.py      # Listens for WS updates, reads map files
└── README.md              # This file
```

## Setup & Run

### Map Server (Node.js)
1. Ensure you have **Node.js 18+** installed.
2. Install dependencies:
   ```bash
   cd server
   npm install
   ```
3. Start the server (default port **3001**):
   ```bash
   npm start
   ```
   The server will expose:
   - `POST   /api/maps` – upload a new map (Full CRUD upload).
   - `GET    /api/maps` – list all map metadata.
   - `GET    /api/maps/:id` – retrieve a single map's meta.
   - `PUT    /api/maps/:id` – replace an existing map.
   - `DELETE /api/maps/:id` – delete a map.
   - `GET    /api/maps/:id/files/<file>` – download stored files (e.g., `map.yaml`).
   - WebSocket endpoint at `ws://localhost:3001/ws` emitting `{type:"mapUpdated", mapId:"<id>"}`.

### Robot Controller (Python)
1. Install Python 3.10+.
2. Install required packages:
   ```bash
   pip install websocket-client
   ```
   *(Only `websocket-client` is required for the demo; you can add `watchdog` for advanced FS watching.)*
3. Run the controller:
   ```bash
   python robot_controller/controller.py
   ```
   The script will connect to the Map Server WebSocket, listen for `mapUpdated` messages, and process the associated files.

## API Payload Example (POST /api/maps)
```json
{
  "floorSize": 20,
  "resolution": 0.05,
  "robot_start_world_x": 2.5,
  "robot_start_world_y": 1.2,
  "objects": [
    {"id": "table1", "type": "table", "x": 4.5, "y": 3.0, "width": 1.0, "height": 1.0, "rotation": 0}
  ],
  "graph": "{\n  \"meta\": {\n    \"version\": 2,\n    \"floorSize\": 20,\n    \"resolution\": 0.05\n  },\n  \"nodes\": [...],\n  \"edges\": [...]\n}",
  "waypoints": "RobotStart_1: 2.50 1.20\nTable_2: 4.50 3.00"
}
```

The server will:
1. Validate required fields.
2. Save `map_graph.json`, `waypoints.txt`.
3. Generate a minimal `map.yaml` (ROS map metadata).
4. Create a placeholder `map.pgm` representing an empty occupancy grid.
5. Broadcast a WebSocket `mapUpdated` event.

## Error Handling
- Missing required fields → `400 Bad Request` with a descriptive error.
- File‑system errors (e.g., permission issues) → `500 Internal Server Error`.
- Robot Controller logs warnings if a map update is received for an unknown ID.

## Extending the System
- **Real PGM generation**: Replace the placeholder PGM creation in `writeMapFiles` with a call to your existing ROS map generation script.
- **ROS Integration**: In `controller.py`, replace the print statements with ROS publishers (`rospy.Publisher` or `rclpy` nodes) to publish the map and waypoints.
- **Authentication**: Add middleware to the Express app to protect the API (JWT/OAuth).
- **Database storage**: Swap the file‑system storage with PostgreSQL, MongoDB, etc., while keeping the same API contract.

---

Feel free to adapt the code to your exact robot stack (ROS 1 vs ROS 2, MQTT, etc.). Let me know if you need further customisation or additional features!
