# robot_controller/controller.py
"""Robot Controller that reacts to new map data.

The controller connects to the Map Server via WebSocket to receive a
`mapUpdated` notification. When a map is created, updated, or deleted it
reads the stored files (graph JSON, waypoints, ROS map files) and logs the
information. In a real robot this would publish to Nav2/MoveBase topics,
re‑calculate paths, etc.

The implementation uses the standard ``websocket-client`` library for the
WebSocket connection and ``watchdog`` to monitor the local data directory as
a fallback when the WebSocket is unavailable.
"""

import json
import os
import threading
import time
from pathlib import Path

import websocket  # type: ignore

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SERVER_HOST = "localhost"
SERVER_PORT = 3001
WS_ENDPOINT = f"ws://{SERVER_HOST}:{SERVER_PORT}/ws"
# Base directory where the Map Server stores per‑map folders.
DATA_ROOT = Path(__file__).resolve().parents[1] / "server" / "data" / "maps"

# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def load_waypoints(map_dir: Path) -> dict:
    """Parse ``waypoints.txt`` into a dict of name → (x, y).

    Expected line format (as sent by the Frontend):
        Name: X Y
    Example: ``Table_2: 4.50 3.00``
    """
    wp_file = map_dir / "waypoints.txt"
    if not wp_file.is_file():
        raise FileNotFoundError(f"{wp_file} does not exist")
    waypoints = {}
    with wp_file.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Split at the first ':'
            if ":" not in line:
                continue
            name, coords = line.split(":", 1)
            parts = coords.strip().split()
            if len(parts) != 2:
                continue
            try:
                x = float(parts[0])
                y = float(parts[1])
                waypoints[name.strip()] = (x, y)
            except ValueError:
                continue
    return waypoints


def load_graph(map_dir: Path) -> dict:
    """Load the ``map_graph.json`` file (stored as a JSON string by the server)."""
    graph_path = map_dir / "map_graph.json"
    if not graph_path.is_file():
        raise FileNotFoundError(f"{graph_path} missing")
    with graph_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def on_map_updated(map_id: str):
    """Callback invoked when the server signals a map update.

    The function reads the relevant files and prints a short summary.
    In a production robot you would publish ROS messages here.
    """
    map_dir = DATA_ROOT / map_id
    if not map_dir.is_dir():
        print(f"[WARN] Received update for unknown map {map_id}")
        return
    try:
        meta_path = map_dir / "meta.json"
        meta = json.load(meta_path.open()) if meta_path.is_file() else {}
        graph = load_graph(map_dir)
        waypoints = load_waypoints(map_dir)
        print(f"[INFO] Map '{map_id}' received/updated.")
        print(f"  Floor size: {meta.get('floorSize')} m")
        print(f"  Resolution: {meta.get('resolution')} m/pixel")
        print(f"  Robot start: ({meta.get('robotStart', {}).get('x')}, {meta.get('robotStart', {}).get('y')})")
        print(f"  Waypoints ({len(waypoints)}): {list(waypoints.keys())}")
        print(f"  Graph nodes: {len(graph.get('nodes', []))}, edges: {len(graph.get('edges', []))}")
        # Placeholder for ROS integration:
        #   publish_map_to_nav2(map_dir)
        #   recalculate_paths()
    except Exception as e:
        print(f"[ERROR] Failed to process map {map_id}: {e}")

# ---------------------------------------------------------------------------
# WebSocket handling
# ---------------------------------------------------------------------------

def run_ws_client():
    """Connect to the Map Server's WebSocket and listen for `mapUpdated` events.
    The function runs in its own thread and reconnects on failure.
    """
    while True:
        try:
            ws = websocket.create_connection(WS_ENDPOINT, timeout=10)
            print("[INFO] Connected to Map Server WebSocket")
            while True:
                raw = ws.recv()
                if not raw:
                    break
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") == "mapUpdated":
                    map_id = msg.get("mapId")
                    if map_id:
                        on_map_updated(map_id)
        except Exception as exc:
            print(f"[WARN] WebSocket connection lost: {exc}. Reconnecting in 5s...")
            time.sleep(5)
        finally:
            try:
                ws.close()
            except Exception:
                pass

# ---------------------------------------------------------------------------
# Fallback file‑system watcher (optional)
# ---------------------------------------------------------------------------

def run_fs_watcher():
    """Watch the data directory for new/changed map directories.
    This is a simple polling implementation to avoid external dependencies.
    """
    known = set()
    while True:
        if DATA_ROOT.is_dir():
            current = {p.name for p in DATA_ROOT.iterdir() if p.is_dir()}
            added = current - known
            for map_id in added:
                on_map_updated(map_id)
            known = current
        time.sleep(10)

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Start WebSocket listener in a background thread.
    ws_thread = threading.Thread(target=run_ws_client, daemon=True)
    ws_thread.start()

    # Optional: also start the file‑system watcher as a safety net.
    fs_thread = threading.Thread(target=run_fs_watcher, daemon=True)
    fs_thread.start()

    print("Robot Controller is running. Press Ctrl+C to exit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down controller...")
