#!/usr/bin/env bash
# Simple curl examples to exercise the Map Server API.
# Adjust the payload JSON as needed.

BASE_URL="http://localhost:3001"

# Example payload (copy from README)
read -r -d '' PAYLOAD <<'EOF'
{
  "floorSize": 20,
  "resolution": 0.05,
  "robot_start_world_x": 2.5,
  "robot_start_world_y": 1.2,
  "objects": [
    {"id": "table1", "type": "table", "x": 4.5, "y": 3.0, "width": 1.0, "height": 1.0, "rotation": 0}
  ],
  "graph": "{\n  \"meta\": {\n    \"version\": 2,\n    \"floorSize\": 20,\n    \"resolution\": 0.05\n  },\n  \"nodes\": [],\n  \"edges\": []\n}",
  "waypoints": "RobotStart_1: 2.50 1.20\nTable_2: 4.50 3.00"
}
EOF

# Create a new map (POST)
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/maps" -H "Content-Type: application/json" -d "$PAYLOAD")
echo "POST response: $CREATE_RESP"
MAP_ID=$(echo "$CREATE_RESP" | python -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
if [ -z "$MAP_ID" ]; then echo "Failed to create map"; exit 1; fi

# List all maps (GET)
curl -s "$BASE_URL/api/maps" | python -m json.tool

# Retrieve a single map meta (GET /api/maps/:id)
curl -s "$BASE_URL/api/maps/$MAP_ID" | python -m json.tool

# Update the map (PUT) – reuse same payload for demo
curl -s -X PUT "$BASE_URL/api/maps/$MAP_ID" -H "Content-Type: application/json" -d "$PAYLOAD" | python -m json.tool

# Delete the map (DELETE)
curl -s -X DELETE "$BASE_URL/api/maps/$MAP_ID" | python -m json.tool
