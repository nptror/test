const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Đường dẫn đến thư mục controller của Webots ---
// Bạn phải sửa đường dẫn này cho đúng với máy của bạn
const WEBOTS_CONTROLLER_DIR = process.env.WEBOTS_CONTROLLER_DIR || 'D:/User/PRM/ProjectGroup/Robot/controllers/Phase_3';// Ví dụ: D:/User/MLN/webots_project/controllers/my_robot_controller

// Hàm tạo occupancy grid từ objects
function buildOccupancyGrid(objects, mapSize) {
    const grid = new Uint8Array(mapSize * mapSize).fill(255); // 255 = free
    const obstacleTypes = ['wall', 'table', 'kitchen', 'restricted'];

    objects.forEach(obj => {
        if (obstacleTypes.includes(obj.type)) {
            const rotation = obj.rotation || 0;
            if (rotation === 0) {
                const x1 = Math.max(0, Math.floor(obj.x));
                const x2 = Math.min(mapSize - 1, Math.floor(obj.x + obj.width));
                const y1 = Math.max(0, Math.floor(obj.y));
                const y2 = Math.min(mapSize - 1, Math.floor(obj.y + obj.height));
                for (let row = y1; row <= y2; row++) {
                    for (let col = x1; col <= x2; col++) {
                        grid[row * mapSize + col] = 0; // obstacle
                    }
                }
            } else {
                const cx = obj.x + obj.width / 2;
                const cy = obj.y + obj.height / 2;
                const rad = (rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const w2 = obj.width / 2;
                const h2 = obj.height / 2;
                const corners = [
                    { x: -w2 * cos - -h2 * sin, y: -w2 * sin + -h2 * cos },
                    { x: w2 * cos - -h2 * sin, y: w2 * sin + -h2 * cos },
                    { x: w2 * cos - h2 * sin, y: w2 * sin + h2 * cos },
                    { x: -w2 * cos - h2 * sin, y: -w2 * sin + h2 * cos }
                ].map(p => ({ x: p.x + cx, y: p.y + cy }));

                const xs = corners.map(p => p.x);
                const ys = corners.map(p => p.y);
                const minX = Math.max(0, Math.floor(Math.min(...xs)));
                const maxX = Math.min(mapSize - 1, Math.ceil(Math.max(...xs)));
                const minY = Math.max(0, Math.floor(Math.min(...ys)));
                const maxY = Math.min(mapSize - 1, Math.ceil(Math.max(...ys)));

                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const dx = x - cx;
                        const dy = y - cy;
                        const rx = dx * cos + dy * sin;
                        const ry = -dx * sin + dy * cos;

                        if (Math.abs(rx) <= w2 && Math.abs(ry) <= h2) {
                            grid[y * mapSize + x] = 0; // obstacle
                        }
                    }
                }
            }
        }
    });
    return grid;
}

// API nhận dữ liệu map
app.post('/api/upload', (req, res) => {

    try {
        console.log("\n================ [SERVER RECEIVE LOG] ================");
        console.log("Thời gian nhận:", new Date().toLocaleString());
        console.log("Kích thước sàn (floorSize):", req.body.floorSize);
        console.log("Độ phân giải (resolution):", req.body.resolution);
        console.log("Tọa độ Start X:", req.body.robot_start_world_x);
        console.log("Tọa độ Start Y:", req.body.robot_start_world_y);
        console.log("Kiểu dữ liệu của Waypoints:", typeof req.body.waypoints);
        console.log("Nội dung Waypoints:\n", req.body.waypoints);
        console.log("======================================================\n");
        const { floorSize, resolution, objects, waypoints = [] } = req.body;

        if (!objects || !floorSize || !resolution) {
            return res.status(400).json({ error: 'Thiếu dữ liệu: floorSize, resolution, objects' });
        }

        const mapSize = Math.floor(floorSize / resolution);
        console.log(`Nhận dữ liệu: floor=${floorSize}m, res=${resolution}m/px, mapSize=${mapSize}px`);

        // 1. Tạo occupancy grid
        const grid = buildOccupancyGrid(objects, mapSize);

        // 2. Tạo file PGM
        const pgmHeader = `P5\n${mapSize} ${mapSize}\n255\n`;
        const pgmBuffer = Buffer.concat([
            Buffer.from(pgmHeader, 'ascii'),
            Buffer.from(grid)
        ]);

        // Đảm bảo thư mục controller tồn tại
        if (!fs.existsSync(WEBOTS_CONTROLLER_DIR)) {
            fs.mkdirSync(WEBOTS_CONTROLLER_DIR, { recursive: true });
        }

        // Ghi file map.pgm
        const pgmPath = path.join(WEBOTS_CONTROLLER_DIR, 'map_nhahang.pgm');
        fs.writeFileSync(pgmPath, pgmBuffer);
        console.log(`Đã ghi file PGM: ${pgmPath}`);

        // 3. Ghi waypoints (nếu có)
        if (waypoints) {
            const waypointPath = path.join(WEBOTS_CONTROLLER_DIR, 'waypoints.txt');
            if (typeof waypoints === 'string') {
                fs.writeFileSync(waypointPath, waypoints);
                console.log(`Đã ghi waypoints (string): ${waypointPath}`);
            } else if (Array.isArray(waypoints) && waypoints.length > 0) {
                const content = waypoints.map(w => `${w.x} ${w.y}`).join('\n');
                fs.writeFileSync(waypointPath, content);
                console.log(`Đã ghi waypoints (array): ${waypointPath}`);
            }
        }

        // 4. Ghi metadata (resolution, floorSize, robot_start) cho robot dùng
        const meta = {
            resolution,
            floorSize,
            mapSize,
            robot_start_x: req.body.robot_start_world_x || 0,
            robot_start_y: req.body.robot_start_world_y || 0
        };
        fs.writeFileSync(
            path.join(WEBOTS_CONTROLLER_DIR, 'map_meta.json'),
            JSON.stringify(meta, null, 2)
        );

        res.json({ success: true, message: 'Đã ghi file vào Webots controller' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- APIs điều khiển và giám sát Robot ---

app.post('/api/robot/control', (req, res) => {
    try {
        const { command, target, direction } = req.body;
        const commandPath = path.join(WEBOTS_CONTROLLER_DIR, 'command.txt');
        
        fs.writeFileSync(commandPath, `${command || 'NONE'} ${target || 'NONE'} ${direction || 'NONE'}`);
        console.log(`>>> [SERVER] Đã ghi lệnh robot: ${command || 'NONE'} ${target || 'NONE'} ${direction || 'NONE'}`);
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
                    status: parts[5]
                });
            }
        }
    } catch (err) {
        // Bỏ qua lỗi đọc file lúc khởi động
    }
    res.json({ x: 0, y: 0, theta: 0, v: 0, omega: 0, status: 'OFFLINE' });
});

app.get('/api/robot/path', (req, res) => {
    try {
        const pathFile = path.join(WEBOTS_CONTROLLER_DIR, 'robot_path.txt');
        if (fs.existsSync(pathFile)) {
            const data = fs.readFileSync(pathFile, 'utf8').trim();
            if (!data || data === 'NONE') {
                return res.json({ path: [] });
            }
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

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});