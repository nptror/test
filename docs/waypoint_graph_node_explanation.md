# Waypoint and Graph Node Documentation

## Graph Node

A **Graph Node** is a fundamental unit in the robot navigation graph that represents a specific location or point of interest in the environment. Each node has a defined type and coordinates, forming the vertices of the navigation graph.

### Key Properties:
- `id`: Unique identifier for the node
- `type`: Classification of the node (e.g., 'robotStart', 'table', 'delivery', 'kitchen', 'charging', 'waypoint')
- `name`: Human-readable name for the node
- `x`, `y`: World coordinates (in meters) of the node's position
- `theta`: Optional orientation angle (in radians)
- `tableNumber`: Optional identifier for table-type nodes
- `deliveryOffsetX/Y`: Optional offsets for delivery positioning

### Node Types:
- `robotStart`: The designated starting position for the robot
- `table`: Represents a table location (converted to 'delivery' type in graph)
- `delivery`: A delivery point associated with a table
- `kitchen`: Kitchen or preparation area
- `charging`: Charging station location
- `waypoint`: Intermediate navigation point

## Waypoint

A **Waypoint** is a specific type of Graph Node with type 'waypoint' that serves as an intermediate navigation point between primary locations. Waypoints are used to guide robots along complex paths, especially when direct connections between primary nodes (like tables or kitchens) are obstructed or inefficient.

### Key Characteristics:
- Waypoints are **not** primary destinations like tables or charging stations
- They serve as **path intermediaries** to enable navigation around obstacles
- Waypoints are often automatically generated during graph construction or imported from legacy route data
- They are included in pathfinding calculations but are not typically user-facing destinations
- Waypoints are validated to ensure connectivity from the robot's starting position

### Usage Context:
- In `validateGraph.ts`: Waypoints are checked for connectivity from robotStart
- In `migrateLegacyGraph.ts`: Legacy route data is parsed into waypoint nodes
- Waypoints are sorted after other anchor nodes (kitchens, charging, deliveries) in the final graph sequence

## Relationship Between Waypoints and Graph Nodes

Waypoints are a **subset** of Graph Nodes. All waypoints are graph nodes, but not all graph nodes are waypoints.

- **Graph Node**: General term for any point in the navigation graph (includes waypoints, robotStart, tables, etc.)
- **Waypoint**: Specific type of graph node used exclusively for intermediate path navigation

The system distinguishes between waypoint nodes and other node types to:
1. Apply different validation rules (e.g., waypoints must be reachable from robotStart)
2. Handle them differently during graph migration from legacy data
3. Optimize pathfinding by treating waypoints as intermediate points rather than destinations

In the navigation system, the robot navigates from primary nodes (robotStart → table → kitchen → charging) using waypoints as necessary to avoid obstacles or follow optimal paths. The graph structure ensures all waypoints are connected to the primary network, enabling complete path coverage throughout the environment.