// Phase 3 with DWA, dynamic map size, auto-resolution, and improved waypoint handling
#include <webots/robot.h>
#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <webots/lidar.h>
#include <webots/keyboard.h>
#include <webots/gps.h>
#include <webots/inertial_unit.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <stdbool.h>
#include <float.h>
#include <string.h>

enum RobotState {
    STATE_IDLE,
    STATE_NAV_TO_TABLE,
    STATE_MANUAL_MOVE,
    STATE_RETURN_TO_KITCHEN
};

// Forward declaration for resolve_graph_target used in read_robot_command
static bool resolve_graph_target(const char *target, double *x, double *y, enum RobotState *state);

#define TIME_STEP 64

// Robot parameters
#define MAX_SPEED 5.5
#define MAX_ACCEL 0.5
#define MAX_OMEGA 2.0
#define MAX_OMEGA_ACCEL 1.0
#define WHEEL_RADIUS 0.0975
#define WHEEL_BASE 0.381

// DWA parameters
#define DT 0.2
#define V_SAMPLES 20
#define OMEGA_SAMPLES 40
#define PREDICT_TIME 2.0
#define HEADING_GAIN 0.3
#define CLEARANCE_GAIN 0.25
#define VEL_GAIN 0.2
#define OBSTACLE_MARGIN 0.15
#define SMOOTH_GAIN 0.15
#define OMEGA_SMOOTH_MAX 0.1
#define OMEGA_SMOOTH_ROTATE 0.3
#define TURN_IN_PLACE_THRESHOLD 1.7
#define SQRT2_MINUS_1 0.41421356237

#define MAX_PATH_STEPS 10000
#define WAYPOINT_ACCEPT_DIST 0.3
#define MAX_WAYPOINTS 20

// Lidar parameters
#define LIDAR_MAX_SAMPLES 512
#define LIDAR_MAX_RANGE 3.0

// Dynamic obstacle map parameters
#define DYNAMIC_DECAY_RATE 4
#define DYNAMIC_OBSTACLE_THRESHOLD 128
#define DYNAMIC_INFLATE_RADIUS 3
#define REPLAN_CHECK_INTERVAL 10
#define REPLAN_LOOKAHEAD 20

// Dynamic map - maximum supported dimension
#define MAX_MAP_DIM 1000
unsigned char static_map[MAX_MAP_DIM][MAX_MAP_DIM];
int MAP_SIZE_W = 400;
int MAP_SIZE_H = 400;
double MAP_RESOLUTION = 0.05;

// A* grid
typedef struct { int x, y; double g, f; int px, py; bool closed; unsigned int gen; } AStarNode;
AStarNode grid[MAX_MAP_DIM][MAX_MAP_DIM];
unsigned int astar_generation = 0;

typedef struct { int x, y; } Node;
typedef struct {
    char name[64];
    double x, y, theta;
    bool valid;
} Waypoint;

typedef struct {
    char id[64];
    char name[64];
    char type[32];
    double x, y, theta;
    bool valid;
} GraphNodeC;

typedef struct {
    char id[64];
    char from[64];
    char to[64];
    bool bidirectional;
    double weight;
    bool valid;
} GraphEdgeC;

enum RobotState robot_state = STATE_IDLE;

const char *get_state_string(enum RobotState state) {
    switch (state) {
        case STATE_NAV_TO_TABLE: return "NAV_TO_TABLE";
        case STATE_MANUAL_MOVE: return "MANUAL_MOVE";
        case STATE_RETURN_TO_KITCHEN: return "RETURN_TO_KITCHEN";
        default: return "IDLE";
    }
}

// Heap
#define HEAP_MAX 200000
typedef struct { int x, y; double f; } HeapNode;
HeapNode heap[HEAP_MAX];
int heap_size = 0;

Node global_path[MAX_PATH_STEPS];
int path_len = 0, path_idx = 0;
bool has_path = false, target_received = false;
double target_x = 0.0, target_y = 0.0;
double start_x = 0.0, start_y = 0.0;

double current_v = 0.0, current_omega = 0.0;

// Track current target waypoint name for dynamic stopping
char current_target_name[64] = "";

WbDeviceTag lidar;
double lidar_ranges[LIDAR_MAX_SAMPLES];
int lidar_actual_count = 0;
double lidar_fov = M_PI;
unsigned char dynamic_map[MAX_MAP_DIM][MAX_MAP_DIM];
unsigned short dist_to_obstacle[MAX_MAP_DIM][MAX_MAP_DIM];

Waypoint waypoints[MAX_WAYPOINTS];
int num_waypoints = 0;

#define MAX_GRAPH_NODES 256
#define MAX_GRAPH_EDGES 512
GraphNodeC graph_nodes[MAX_GRAPH_NODES];
GraphEdgeC graph_edges[MAX_GRAPH_EDGES];
int num_graph_nodes = 0;
int num_graph_edges = 0;

static int graph_route[MAX_PATH_STEPS];
static int graph_route_len = 0;
static bool graph_route_requested = false;
static bool graph_path_active = false;
static bool path_is_graph = false;

// --- Helper: is current target a Table waypoint? ---
bool is_table_target(void) {
    return (strstr(current_target_name, "Table") != NULL ||
            strstr(current_target_name, "table") != NULL);
}

// --- Helper: dynamic stopping distance based on target type ---
double get_stopping_distance(void) {
    if (is_table_target()) return 0.05;
    return 0.15;
}

// --- Helper: check if robot velocity is near zero (DWA has decelerated) ---
bool is_velocity_near_zero(double vl, double vr) {
    return (fabs(vl) < 0.01 && fabs(vr) < 0.01);
}

static int dwa_debug_tick = 0;
static int dwa_blocked_debug_tick = 0;

// ------------------------------------------------------------
// Heap functions
void heap_push(int x, int y, double f) {
    if (heap_size >= HEAP_MAX) return;
    int i = heap_size++;
    heap[i].x = x; heap[i].y = y; heap[i].f = f;
    while (i > 0) {
        int p = (i-1)/2;
        if (heap[p].f <= f) break;
        heap[i] = heap[p];
        i = p;
    }
    heap[i].x = x; heap[i].y = y; heap[i].f = f;
}

HeapNode heap_pop() {
    HeapNode top = heap[0];
    heap[0] = heap[--heap_size];
    int i = 0;
    while (1) {
        int left = 2*i+1, right = 2*i+2, smallest = i;
        if (left < heap_size && heap[left].f < heap[smallest].f) smallest = left;
        if (right < heap_size && heap[right].f < heap[smallest].f) smallest = right;
        if (smallest == i) break;
        HeapNode tmp = heap[i];
        heap[i] = heap[smallest];
        heap[smallest] = tmp;
        i = smallest;
    }
    return top;
}

double heuristic(int x1, int y1, int x2, int y2) {
    int dx = abs(x1 - x2);
    int dy = abs(y1 - y2);
    return (dx > dy) ? dx + SQRT2_MINUS_1 * dy : dy + SQRT2_MINUS_1 * dx;
}

// ------------------------------------------------------------
// Coordinate conversion (world <-> map) – đồng bộ, bỏ round
void world_to_map(double wx, double wy, int *mx, int *my) {
    int cx = MAP_SIZE_W / 2;
    int cy = MAP_SIZE_H / 2;
    *mx = cx + (int)(wx / MAP_RESOLUTION);
    *my = cy - (int)(wy / MAP_RESOLUTION);

    if (*mx < 0) *mx = 0;
    if (*mx >= MAP_SIZE_W) *mx = MAP_SIZE_W - 1;
    if (*my < 0) *my = 0;
    if (*my >= MAP_SIZE_H) *my = MAP_SIZE_H - 1;
}

void map_to_world(int mx, int my, double *wx, double *wy) {
    int cx = MAP_SIZE_W / 2;
    int cy = MAP_SIZE_H / 2;
    *wx = (mx - cx) * MAP_RESOLUTION;
    *wy = (cy - my) * MAP_RESOLUTION;
}

// ------------------------------------------------------------
// Map helpers
bool is_free(int x, int y) {
    if (x < 0 || x >= MAP_SIZE_W || y < 0 || y >= MAP_SIZE_H) return false;
    return (static_map[y][x] >= 128) && (dynamic_map[y][x] >= DYNAMIC_OBSTACLE_THRESHOLD);
}

bool is_free_static(int x, int y) {
    if (x < 0 || x >= MAP_SIZE_W || y < 0 || y >= MAP_SIZE_H) return false;
    return (static_map[y][x] >= 128);
}

bool find_free(int *x, int *y, int r) {
    if (is_free(*x, *y)) return true;
    for (int rad = 1; rad <= r; rad++) {
        for (int i = -rad; i <= rad; i++) {
            int nx = *x + i;
            if (nx >= 0 && nx < MAP_SIZE_W) {
                int ny_top = *y - rad, ny_bot = *y + rad;
                if (ny_top >= 0 && ny_top < MAP_SIZE_H && is_free(nx, ny_top)) { *x = nx; *y = ny_top; return true; }
                if (ny_bot >= 0 && ny_bot < MAP_SIZE_H && is_free(nx, ny_bot)) { *x = nx; *y = ny_bot; return true; }
            }
        }
        for (int i = -rad + 1; i < rad; i++) {
            int ny = *y + i;
            if (ny >= 0 && ny < MAP_SIZE_H) {
                int nx_left = *x - rad, nx_right = *x + rad;
                if (nx_left >= 0 && nx_left < MAP_SIZE_W && is_free(nx_left, ny)) { *x = nx_left; *y = ny; return true; }
                if (nx_right >= 0 && nx_right < MAP_SIZE_W && is_free(nx_right, ny)) { *x = nx_right; *y = ny; return true; }
            }
        }
    }
    return false;
}

// ------------------------------------------------------------
// Load map PGM
bool load_map(const char *f) {
    FILE *fp = fopen(f, "rb");
    if (!fp) return false;
    char h[16];
    int w, hh, mv;
    if (!fgets(h, 16, fp)) { fclose(fp); return false; }
    char c = fgetc(fp);
    while (c == '#') { while (fgetc(fp) != '\n'); c = fgetc(fp); }
    ungetc(c, fp);
    if (fscanf(fp, "%d %d %d", &w, &hh, &mv) != 3) { fclose(fp); return false; }
    fgetc(fp);
    if (w > MAX_MAP_DIM || hh > MAX_MAP_DIM) {
        printf("Map too large: %dx%d > %d\n", w, hh, MAX_MAP_DIM);
        fclose(fp);
        return false;
    }
    MAP_SIZE_W = w;
    MAP_SIZE_H = hh;
    
    size_t read_bytes = fread(static_map, 1, MAP_SIZE_W * MAP_SIZE_H, fp);
    fclose(fp);
    
    // Read map_meta.json
    FILE *fmeta = fopen("map_meta.json", "r");
    if (fmeta) {
        char meta_data[1024];
        size_t n = fread(meta_data, 1, sizeof(meta_data)-1, fmeta);
        meta_data[n] = '\0';
        fclose(fmeta);
        
        char *res_ptr = strstr(meta_data, "\"resolution\"");
        if (res_ptr) {
            res_ptr = strchr(res_ptr, ':');
            if (res_ptr) sscanf(res_ptr + 1, "%lf", &MAP_RESOLUTION);
        }
    } else {
        MAP_RESOLUTION = 20.0 / MAP_SIZE_W; // fallback
    }

    printf("Map loaded: %dx%d px, resolution = %.4f m/px\n", MAP_SIZE_W, MAP_SIZE_H, MAP_RESOLUTION);
    return (read_bytes > 0);
}

// ------------------------------------------------------------
// Đọc metadata robotStart từ file (lưu vào biến truyền vào)
void load_meta(double *start_x, double *start_y) {
    FILE *fp = fopen("map_meta.json", "r");
    if (!fp) {
        printf("No map_meta.json found. Using default start (0,0).\n");
        *start_x = 0.0;
        *start_y = 0.0;
        return;
    }
    char buf[1024];
    size_t n = fread(buf, 1, sizeof(buf) - 1, fp);
    buf[n] = '\0';
    fclose(fp);

    char *px = strstr(buf, "\"robotStart\"");
    if (px) {
        char *xx = strstr(px, "\"x\"");
        if (xx) {
            xx = strchr(xx, ':');
            if (xx) sscanf(xx + 1, "%lf", start_x);
        }
        char *yy = strstr(px, "\"y\"");
        if (yy) {
            yy = strchr(yy, ':');
            if (yy) sscanf(yy + 1, "%lf", start_y);
        }
    } else {
        // Fallback for old format
        px = strstr(buf, "\"robot_start_x\"");
        if (px) {
            px = strchr(px, ':');
            if (px) sscanf(px + 1, "%lf", start_x);
        }
        char *py = strstr(buf, "\"robot_start_y\"");
        if (py) {
            py = strchr(py, ':');
            if (py) sscanf(py + 1, "%lf", start_y);
        }
    }
    printf("Loaded robot start position from meta: (%.2f, %.2f)\n", *start_x, *start_y);
}

// Ghi planned path ra file để UI hiển thị
void write_path_to_file(double robot_x, double robot_y) {
    FILE *fp = fopen("robot_path.txt", "w");
    if (!fp) return;
    fprintf(fp, "%.4f %.4f\n", robot_x, robot_y);
    if (path_is_graph) {
        for (int i = 0; i < path_len; i++) {
            int node_idx = global_path[i].x;
            if (node_idx < 0 || node_idx >= num_graph_nodes) continue;
            fprintf(fp, "%s %.4f %.4f\n", graph_nodes[node_idx].name, graph_nodes[node_idx].x, graph_nodes[node_idx].y);
        }
    } else {
        for (int i = 0; i < path_len; i++) {
            double wx, wy;
            map_to_world(global_path[i].x, global_path[i].y, &wx, &wy);
            fprintf(fp, "%.4f %.4f\n", wx, wy);
        }
    }
    fprintf(fp, "%.4f %.4f\n", target_x, target_y);
    fclose(fp);
}

void clear_path_file(void) {
    FILE *fp = fopen("robot_path.txt", "w");
    if (fp) { fprintf(fp, "NONE\n"); fclose(fp); }
}

// Ghi trạng thái robot ra file robot_state.txt
void write_robot_state(double x, double y, double theta, double v, double omega, const char *status) {
    FILE *fp = fopen("robot_state.txt", "w");
    if (fp) {
        fprintf(fp, "%.4f %.4f %.4f %.4f %.4f %s\n", x, y, theta, v, omega, status);
        fclose(fp);
    }
}

// Đọc lệnh từ file command.txt
void read_robot_command(double *target_x, double *target_y, bool *target_received, bool *has_path, enum RobotState *state, WbDeviceTag left_motor, WbDeviceTag right_motor, double *manual_v, double *manual_omega) {
    FILE *fp = fopen("command.txt", "r");
    if (!fp) return;
    char cmd[32] = "NONE";
    char target[32] = "NONE";
    char direction[32] = "NONE";
    
    if (fscanf(fp, "%31s %31s %31s", cmd, target, direction) == 3) {
        if (strcmp(cmd, "NAV_TO_TABLE") == 0) {
            if (resolve_graph_target(target, target_x, target_y, state)) {
                *target_received = true;
                *has_path = false;
                graph_route_len = 0;
                graph_route_requested = true;
                graph_path_active = false;
                printf("Command: NAV_TO_TABLE -> %s (%.2f, %.2f)\n", target, *target_x, *target_y);
            } else {
                printf("Command: NAV_TO_TABLE target not found: %s\n", target);
            }
        } else if (strcmp(cmd, "MANUAL_MOVE") == 0) {
            *state = STATE_MANUAL_MOVE;
            *target_received = false;
            *has_path = false;
            
            if (strcmp(direction, "FORWARD") == 0) {
                *manual_v = 0.5;
                *manual_omega = 0.0;
            } else if (strcmp(direction, "BACKWARD") == 0) {
                *manual_v = -0.5;
                *manual_omega = 0.0;
            } else if (strcmp(direction, "LEFT") == 0) {
                *manual_v = 0.0;
                *manual_omega = 0.8;
            } else if (strcmp(direction, "RIGHT") == 0) {
                *manual_v = 0.0;
                *manual_omega = -0.8;
            } else if (strcmp(direction, "STOP") == 0) {
                *manual_v = 0.0;
                *manual_omega = 0.0;
                *state = STATE_IDLE;
            }
        } else if (strcmp(cmd, "STOP") == 0) {
            *target_received = false;
            *has_path = false;
            *state = STATE_IDLE;
            *manual_v = 0.0;
            *manual_omega = 0.0;
            wb_motor_set_velocity(left_motor, 0.0);
            wb_motor_set_velocity(right_motor, 0.0);
            clear_path_file();
            printf("Command: STOP\n");
        }
    }
    fclose(fp);
    
    // Clear command.txt to avoid repeating the command
    if (strcmp(cmd, "NONE") != 0) {
        FILE *f_clear = fopen("command.txt", "w");
        if (f_clear) {
            fprintf(f_clear, "NONE NONE NONE\n");
            fclose(f_clear);
        }
    }
}

// ------------------------------------------------------------
// Đọc graph.json (topology)
static bool parse_graph_json(const char *path) {
    FILE *fp = fopen(path, "r");
    if (!fp) {
        printf("No graph.json found.\n");
        return false;
    }

    fseek(fp, 0, SEEK_END);
    long fsize = ftell(fp);
    rewind(fp);
    if (fsize <= 0 || fsize > 1024 * 1024) {
        fclose(fp);
        printf("graph.json size invalid: %ld\n", fsize);
        return false;
    }

    char *buf = (char *)malloc((size_t)fsize + 1);
    if (!buf) {
        fclose(fp);
        printf("Failed to allocate buffer for graph.json\n");
        return false;
    }
    size_t read = fread(buf, 1, (size_t)fsize, fp);
    buf[read] = '\0';
    fclose(fp);

    num_graph_nodes = 0;
    num_graph_edges = 0;

    const char *nodes_section = strstr(buf, "\"nodes\"");
    const char *edges_section = strstr(buf, "\"edges\"");

    if (nodes_section) {
        const char *p = strchr(nodes_section, '[');
        if (p) {
            p++;
            while ((p = strstr(p, "\"id\"")) && (edges_section == NULL || p < edges_section) && num_graph_nodes < MAX_GRAPH_NODES) {
                const char *obj_start = p;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                char id[64] = "";
                char type[32] = "";
                char name[64] = "";
                double x = 0.0, y = 0.0, theta = 0.0;

                const char *id_q1 = strchr(obj_start + 4, '"');
                const char *id_q2 = id_q1 ? strchr(id_q1 + 1, '"') : NULL;
                if (!id_q1 || !id_q2) break;
                size_t id_len = (size_t)(id_q2 - id_q1 - 1);
                if (id_len >= sizeof(id)) id_len = sizeof(id) - 1;
                memcpy(id, id_q1 + 1, id_len);
                id[id_len] = '\0';

                const char *type_pos = strstr(obj_start, "\"type\"");
                const char *name_pos = strstr(obj_start, "\"name\"");
                const char *x_pos = strstr(obj_start, "\"x\"");
                const char *y_pos = strstr(obj_start, "\"y\"");
                if (!type_pos || !name_pos || !x_pos || !y_pos) break;

                const char *type_q1 = strchr(type_pos + 6, '"');
                const char *type_q2 = type_q1 ? strchr(type_q1 + 1, '"') : NULL;
                const char *name_q1 = strchr(name_pos + 6, '"');
                const char *name_q2 = name_q1 ? strchr(name_q1 + 1, '"') : NULL;
                if (!type_q1 || !type_q2 || !name_q1 || !name_q2) break;
                size_t type_len = (size_t)(type_q2 - type_q1 - 1);
                size_t name_len = (size_t)(name_q2 - name_q1 - 1);
                if (type_len >= sizeof(type)) type_len = sizeof(type) - 1;
                if (name_len >= sizeof(name)) name_len = sizeof(name) - 1;
                memcpy(type, type_q1 + 1, type_len);
                type[type_len] = '\0';
                memcpy(name, name_q1 + 1, name_len);
                name[name_len] = '\0';

                sscanf(x_pos, "\"x\"%*[^0-9.-]%lf", &x);
                sscanf(y_pos, "\"y\"%*[^0-9.-]%lf", &y);
                const char *theta_pos = strstr(obj_start, "\"theta\"");
                if (theta_pos) sscanf(theta_pos, "\"theta\"%*[^0-9.-]%lf", &theta);

                snprintf(graph_nodes[num_graph_nodes].id, sizeof(graph_nodes[num_graph_nodes].id), "%s", id);
                snprintf(graph_nodes[num_graph_nodes].name, sizeof(graph_nodes[num_graph_nodes].name), "%s", name);
                snprintf(graph_nodes[num_graph_nodes].type, sizeof(graph_nodes[num_graph_nodes].type), "%s", type);
                graph_nodes[num_graph_nodes].x = x;
                graph_nodes[num_graph_nodes].y = y;
                graph_nodes[num_graph_nodes].theta = theta;
                graph_nodes[num_graph_nodes].valid = true;
                num_graph_nodes++;
                p = obj_end + 1;
            }
        }
    }

    if (edges_section) {
        const char *p = strchr(edges_section, '[');
        if (p) {
            p++;
            while ((p = strstr(p, "\"from\"")) && num_graph_edges < MAX_GRAPH_EDGES) {
                const char *obj_start = p;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                char id[64] = "";
                char from[64] = "";
                char to[64] = "";
                bool bidirectional = true;
                double weight = 1.0;

                const char *id_pos = strstr(obj_start, "\"id\"");
                if (id_pos) {
                    const char *id_q1 = strchr(id_pos + 4, '"');
                    const char *id_q2 = id_q1 ? strchr(id_q1 + 1, '"') : NULL;
                    if (id_q1 && id_q2) {
                        size_t id_len = (size_t)(id_q2 - id_q1 - 1);
                        if (id_len >= sizeof(id)) id_len = sizeof(id) - 1;
                        memcpy(id, id_q1 + 1, id_len);
                        id[id_len] = '\0';
                    }
                }

                const char *from_pos = strstr(obj_start, "\"from\"");
                const char *to_pos = strstr(obj_start, "\"to\"");
                if (!from_pos || !to_pos) break;
                const char *from_q1 = strchr(from_pos + 6, '"');
                const char *from_q2 = from_q1 ? strchr(from_q1 + 1, '"') : NULL;
                const char *to_q1 = strchr(to_pos + 4, '"');
                const char *to_q2 = to_q1 ? strchr(to_q1 + 1, '"') : NULL;
                if (!from_q1 || !from_q2 || !to_q1 || !to_q2) break;
                size_t from_len = (size_t)(from_q2 - from_q1 - 1);
                size_t to_len = (size_t)(to_q2 - to_q1 - 1);
                if (from_len >= sizeof(from)) from_len = sizeof(from) - 1;
                if (to_len >= sizeof(to)) to_len = sizeof(to) - 1;
                memcpy(from, from_q1 + 1, from_len);
                from[from_len] = '\0';
                memcpy(to, to_q1 + 1, to_len);
                to[to_len] = '\0';

                const char *w_pos = strstr(obj_start, "\"weight\"");
                if (w_pos) sscanf(w_pos, "\"weight\"%*[^0-9.-]%lf", &weight);
                const char *b_pos = strstr(obj_start, "\"bidirectional\"");
                if (b_pos) {
                    if (strstr(b_pos, "false") && (!strstr(b_pos, "true") || strstr(b_pos, "false") < strstr(b_pos, "true"))) {
                        bidirectional = false;
                    } else {
                        bidirectional = true;
                    }
                }

                snprintf(graph_edges[num_graph_edges].id, sizeof(graph_edges[num_graph_edges].id), "%s", id);
                snprintf(graph_edges[num_graph_edges].from, sizeof(graph_edges[num_graph_edges].from), "%s", from);
                snprintf(graph_edges[num_graph_edges].to, sizeof(graph_edges[num_graph_edges].to), "%s", to);
                graph_edges[num_graph_edges].bidirectional = bidirectional;
                graph_edges[num_graph_edges].weight = weight;
                graph_edges[num_graph_edges].valid = true;
                num_graph_edges++;
                p = obj_end + 1;
            }
        }
    }

    free(buf);
    printf("Loaded graph.json: %d nodes, %d edges\n", num_graph_nodes, num_graph_edges);
    return num_graph_nodes > 0;
}

static int find_graph_node_index_by_name_or_id(const char *target) {
    for (int i = 0; i < num_graph_nodes; i++) {
        if (!graph_nodes[i].valid) continue;
        if (strcmp(graph_nodes[i].id, target) == 0 || strcmp(graph_nodes[i].name, target) == 0) return i;
        if (strstr(graph_nodes[i].id, target) != NULL || strstr(graph_nodes[i].name, target) != NULL) return i;
    }
    return -1;
}

static int find_nearest_graph_node(double x, double y) {
    int best_idx = -1;
    double best_dist = INFINITY;
    for (int i = 0; i < num_graph_nodes; i++) {
        if (!graph_nodes[i].valid) continue;
        double d = hypot(graph_nodes[i].x - x, graph_nodes[i].y - y);
        if (d < best_dist) {
            best_dist = d;
            best_idx = i;
        }
    }
    return best_idx;
}

/* 
static int find_graph_edge_index_by_nodes(int from_idx, int to_idx) {
    if (from_idx < 0 || to_idx < 0) return -1;
    const char *from_id = graph_nodes[from_idx].id;
    const char *to_id = graph_nodes[to_idx].id;
    for (int i = 0; i < num_graph_edges; i++) {
        if (!graph_edges[i].valid) continue;
        if ((strcmp(graph_edges[i].from, from_id) == 0 && strcmp(graph_edges[i].to, to_id) == 0) ||
            (graph_edges[i].bidirectional && strcmp(graph_edges[i].from, to_id) == 0 && strcmp(graph_edges[i].to, from_id) == 0)) {
            return i;
        }
    }
    return -1;
}
*/

static void build_graph_route_from_indices(int start_idx, int goal_idx) {
    graph_route_len = 0;
    graph_path_active = false;

    if (start_idx < 0 || goal_idx < 0) return;
    if (start_idx == goal_idx) {
        graph_route[graph_route_len++] = start_idx;
        graph_path_active = true;
        return;
    }

    static double dist[MAX_GRAPH_NODES];
    static int prev[MAX_GRAPH_NODES];
    static bool visited[MAX_GRAPH_NODES];
    for (int i = 0; i < MAX_GRAPH_NODES; i++) {
        dist[i] = INFINITY;
        prev[i] = -1;
        visited[i] = false;
    }

    dist[start_idx] = 0.0;

    for (int iter = 0; iter < num_graph_nodes; iter++) {
        int u = -1;
        double best = INFINITY;
        for (int i = 0; i < num_graph_nodes; i++) {
            if (!visited[i] && graph_nodes[i].valid && dist[i] < best) {
                best = dist[i];
                u = i;
            }
        }
        if (u < 0) break;
        visited[u] = true;
        if (u == goal_idx) break;

        for (int e = 0; e < num_graph_edges; e++) {
            if (!graph_edges[e].valid) continue;
            int v = -1;
            if (strcmp(graph_edges[e].from, graph_nodes[u].id) == 0) {
                v = find_graph_node_index_by_name_or_id(graph_edges[e].to);
            } else if (graph_edges[e].bidirectional && strcmp(graph_edges[e].to, graph_nodes[u].id) == 0) {
                v = find_graph_node_index_by_name_or_id(graph_edges[e].from);
            }
            if (v < 0 || visited[v] || !graph_nodes[v].valid) continue;

            double w = graph_edges[e].weight;
            if (!(w > 0.0)) {
                w = hypot(graph_nodes[v].x - graph_nodes[u].x, graph_nodes[v].y - graph_nodes[u].y);
            }
            double alt = dist[u] + w;
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
            }
        }
    }

    if (prev[goal_idx] == -1) {
        printf("Graph path not found: %s -> %s\n", graph_nodes[start_idx].name, graph_nodes[goal_idx].name);
        return;
    }

    int rev[MAX_GRAPH_NODES];
    int len = 0;
    for (int v = goal_idx; v >= 0 && len < MAX_GRAPH_NODES; v = prev[v]) {
        rev[len++] = v;
        if (v == start_idx) break;
    }
    if (len == 0 || rev[len - 1] != start_idx) {
        printf("Graph route reconstruction failed.\n");
        return;
    }

    for (int i = len - 1; i >= 0 && graph_route_len < MAX_PATH_STEPS; i--) {
        graph_route[graph_route_len++] = rev[i];
    }
    graph_path_active = graph_route_len > 0;
    printf("Graph route built: %d nodes\n", graph_route_len);
}

static bool resolve_graph_target(const char *target, double *x, double *y, enum RobotState *state) {
    if (strcmp(target, "robotStart") == 0 || strcmp(target, "START") == 0) {
        *x = start_x;
        *y = start_y;
        *state = STATE_RETURN_TO_KITCHEN;
        strncpy(current_target_name, "robotStart", sizeof(current_target_name) - 1);
        current_target_name[sizeof(current_target_name) - 1] = '\0';
        return true;
    }

    int idx = find_graph_node_index_by_name_or_id(target);
    if (idx >= 0) {
        *x = graph_nodes[idx].x;
        *y = graph_nodes[idx].y;
        *state = STATE_NAV_TO_TABLE;
        strncpy(current_target_name, graph_nodes[idx].name, sizeof(current_target_name) - 1);
        current_target_name[sizeof(current_target_name) - 1] = '\0';
        return true;
    }

    return false;
}

// ------------------------------------------------------------
// Dynamic obstacle map functions
// ------------------------------------------------------------
void init_dynamic_map(void) {
    memset(dynamic_map, 255, sizeof(dynamic_map));
}

void decay_dynamic_map(void) {
    for (int y = 0; y < MAP_SIZE_H; y++) {
        for (int x = 0; x < MAP_SIZE_W; x++) {
            if (dynamic_map[y][x] < 255) {
                int val = dynamic_map[y][x] + DYNAMIC_DECAY_RATE;
                dynamic_map[y][x] = (unsigned char)(val > 255 ? 255 : val);
            }
        }
    }
}

void mark_dynamic_obstacle(int mx, int my) {
    for (int dy = -DYNAMIC_INFLATE_RADIUS; dy <= DYNAMIC_INFLATE_RADIUS; dy++) {
        for (int dx = -DYNAMIC_INFLATE_RADIUS; dx <= DYNAMIC_INFLATE_RADIUS; dx++) {
            if (dx * dx + dy * dy > DYNAMIC_INFLATE_RADIUS * DYNAMIC_INFLATE_RADIUS) continue;
            int nx = mx + dx, ny = my + dy;
            if (nx < 0 || nx >= MAP_SIZE_W || ny < 0 || ny >= MAP_SIZE_H) continue;
            if (static_map[ny][nx] >= 128) {
                dynamic_map[ny][nx] = 0;
            }
        }
    }
}

void update_dynamic_map_from_lidar(double robot_x, double robot_y, double robot_theta,
                                    const double *ranges, int count, double fov) {
    decay_dynamic_map();

    if (count <= 0) return;

    double angle_min = -fov / 2.0;
    double angle_inc = (count > 1) ? fov / (double)(count - 1) : 0.0;

    for (int i = 0; i < count; i++) {
        double range = ranges[i];
        if (!isfinite(range) || range <= 0.05 || range >= LIDAR_MAX_RANGE) continue;

        double angle = robot_theta + angle_min + angle_inc * i;
        double wx = robot_x + range * cos(angle);
        double wy = robot_y + range * sin(angle);

        int mx, my;
        world_to_map(wx, wy, &mx, &my);

        if (static_map[my][mx] >= 128) {
            mark_dynamic_obstacle(mx, my);
        }
    }

    // Clear robot's own footprint — must cover full body (WHEEL_BASE=0.381m ≈ ±4px)
    int rmx, rmy;
    world_to_map(robot_x, robot_y, &rmx, &rmy);
    for (int dy = -4; dy <= 4; dy++) {
        for (int dx = -4; dx <= 4; dx++) {
            int nx = rmx + dx, ny = rmy + dy;
            if (nx >= 0 && nx < MAP_SIZE_W && ny >= 0 && ny < MAP_SIZE_H) {
                dynamic_map[ny][nx] = 255;
            }
        }
    }
}

bool check_path_blocked_by_dynamic(void) {
    if (!has_path || path_idx >= path_len) return false;

    int check_end = path_idx + REPLAN_LOOKAHEAD;
    if (check_end > path_len) check_end = path_len;

    for (int i = path_idx; i < check_end; i++) {
        int px = global_path[i].x;
        int py = global_path[i].y;
        if (path_is_graph) {
            if (px < 0 || px >= num_graph_nodes) continue;
            int nx = px;
            int ny = (i + 1 < path_len) ? global_path[i + 1].x : px;
            if (ny < 0 || ny >= num_graph_nodes) continue;
            double wx0 = graph_nodes[nx].x, wy0 = graph_nodes[nx].y;
            double wx1 = graph_nodes[ny].x, wy1 = graph_nodes[ny].y;
            int steps = (int)(hypot(wx1 - wx0, wy1 - wy0) / MAP_RESOLUTION);
            if (steps < 1) steps = 1;
            for (int s = 0; s <= steps; s++) {
                double t = (double)s / (double)steps;
                double wx = wx0 + (wx1 - wx0) * t;
                double wy = wy0 + (wy1 - wy0) * t;
                int mx, my;
                world_to_map(wx, wy, &mx, &my);
                if (mx >= 0 && mx < MAP_SIZE_W && my >= 0 && my < MAP_SIZE_H) {
                    if (dynamic_map[my][mx] < DYNAMIC_OBSTACLE_THRESHOLD) {
                        if (dwa_blocked_debug_tick++ % 5 == 0) {
                            printf("Graph segment blocked by dynamic map at idx=%d cell=(%d,%d) dyn=%u threshold=%u\n",
                                   i, mx, my, dynamic_map[my][mx], DYNAMIC_OBSTACLE_THRESHOLD);
                        }
                        return true;
                    }
                }
            }
        } else {
            if (px >= 0 && px < MAP_SIZE_W && py >= 0 && py < MAP_SIZE_H) {
                if (dynamic_map[py][px] < DYNAMIC_OBSTACLE_THRESHOLD) {
                    if (dwa_blocked_debug_tick++ % 5 == 0) {
                        printf("Path blocked by dynamic map at idx=%d cell=(%d,%d) dyn=%u threshold=%u\n",
                               i, px, py, dynamic_map[py][px], DYNAMIC_OBSTACLE_THRESHOLD);
                    }
                    return true;
                }
            }
        }
    }
    return false;
}

// ------------------------------------------------------------
// Adjust goal cell out of inflation zone along obstacle->goal vector
// Returns true if adjustment was made
bool adjust_goal_for_inflation(int *gx, int *gy) {
    if (is_free(*gx, *gy)) return false;

    // Find the nearest obstacle center by scanning around goal
    int obs_cx = *gx, obs_cy = *gy;
    double min_obs_dist = 1e6;
    int scan_r = 10;
    for (int dy = -scan_r; dy <= scan_r; dy++) {
        for (int dx = -scan_r; dx <= scan_r; dx++) {
            int nx = *gx + dx, ny = *gy + dy;
            if (nx < 0 || nx >= MAP_SIZE_W || ny < 0 || ny >= MAP_SIZE_H) continue;
            // Hard obstacle: pixel value near 0
            if (static_map[ny][nx] < 50) {
                double d = hypot(dx, dy);
                if (d < min_obs_dist) {
                    min_obs_dist = d;
                    obs_cx = nx;
                    obs_cy = ny;
                }
            }
        }
    }

    // Compute direction vector from obstacle center to goal
    double vx = (double)(*gx - obs_cx);
    double vy = (double)(*gy - obs_cy);
    double vlen = hypot(vx, vy);
    if (vlen < 0.001) {
        // Goal is right on obstacle center — push in +x direction as fallback
        vx = 1.0; vy = 0.0; vlen = 1.0;
    }
    vx /= vlen;
    vy /= vlen;

    // Walk outward along the vector 1 pixel at a time until we find a free cell
    for (int step = 1; step <= 20; step++) {
        int nx = *gx + (int)(vx * step);
        int ny = *gy + (int)(vy * step);
        if (nx < 0 || nx >= MAP_SIZE_W || ny < 0 || ny >= MAP_SIZE_H) continue;
        if (is_free(nx, ny)) {
            printf("Goal adjusted from (%d,%d) to (%d,%d) — pushed %d px out of inflation zone\n",
                   *gx, *gy, nx, ny, step);
            *gx = nx;
            *gy = ny;
            return true;
        }
    }

    // Fallback: find nearest free cell (original behavior)
    return false;
}

// ------------------------------------------------------------
// Distance transform — Chebyshev distance to nearest obstacle
// Single lookup replaces 5×5 neighbor scan in DWA clearance check
void compute_distance_transform(void) {
    int h = MAP_SIZE_H, w = MAP_SIZE_W;
    for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
            dist_to_obstacle[y][x] = is_free(x, y) ? 30000 : 0;

    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            unsigned short d = dist_to_obstacle[y][x];
            if (d == 0) continue;
            if (y > 0) {
                unsigned short u = dist_to_obstacle[y-1][x] + 1; if (u < d) d = u;
                if (x > 0)   { u = dist_to_obstacle[y-1][x-1] + 1; if (u < d) d = u; }
                if (x < w-1) { u = dist_to_obstacle[y-1][x+1] + 1; if (u < d) d = u; }
            }
            if (x > 0) { unsigned short u = dist_to_obstacle[y][x-1] + 1; if (u < d) d = u; }
            dist_to_obstacle[y][x] = d;
        }
    }
    for (int y = h - 1; y >= 0; y--) {
        for (int x = w - 1; x >= 0; x--) {
            unsigned short d = dist_to_obstacle[y][x];
            if (d == 0) continue;
            if (y < h-1) {
                unsigned short u = dist_to_obstacle[y+1][x] + 1; if (u < d) d = u;
                if (x > 0)   { u = dist_to_obstacle[y+1][x-1] + 1; if (u < d) d = u; }
                if (x < w-1) { u = dist_to_obstacle[y+1][x+1] + 1; if (u < d) d = u; }
            }
            if (x < w-1) { unsigned short u = dist_to_obstacle[y][x+1] + 1; if (u < d) d = u; }
            dist_to_obstacle[y][x] = d;
        }
    }
}

// A* generation-based lazy cell init — O(1) instead of O(W*H)
static inline void grid_init_cell(int x, int y) {
    if (grid[y][x].gen != astar_generation) {
        grid[y][x].g = INFINITY;
        grid[y][x].f = INFINITY;
        grid[y][x].closed = false;
        grid[y][x].gen = astar_generation;
    }
}

// Bresenham line-of-sight check on the map
bool line_of_sight(int x0, int y0, int x1, int y1) {
    int dx = abs(x1 - x0), dy = abs(y1 - y0);
    int sx = (x0 < x1) ? 1 : -1;
    int sy = (y0 < y1) ? 1 : -1;
    int err = dx - dy;
    while (1) {
        if (!is_free_static(x0, y0)) return false;
        if (x0 == x1 && y0 == y1) return true;
        int e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx)  { err += dx; y0 += sy; }
    }
}

// Greedy path simplification — scan from farthest to nearest for each anchor
void simplify_path(void) {
    if (path_len <= 2) return;
    static Node simplified[MAX_PATH_STEPS];
    int slen = 0;
    simplified[slen++] = global_path[0];

    int anchor = 0;
    while (anchor < path_len - 1) {
        int farthest = anchor + 1;
        for (int i = path_len - 1; i > anchor + 1; i--) {
            if (line_of_sight(global_path[anchor].x, global_path[anchor].y,
                              global_path[i].x, global_path[i].y)) {
                farthest = i;
                break;
            }
        }
        simplified[slen++] = global_path[farthest];
        anchor = farthest;
    }

    int original_len = path_len;
    path_len = slen;
    memcpy(global_path, simplified, slen * sizeof(Node));
    printf("Path simplified: %d -> %d waypoints\n", original_len, slen);
}

// ------------------------------------------------------------
// A* planning
bool plan_path(int sx, int sy, int gx, int gy) {
    int search_radius = 50;
    if (!find_free(&sx, &sy, search_radius)) {
        printf("A* Error: Cannot find free cell near start!\n");
        return false;
    }
    if (!is_free(gx, gy)) {
        if (!adjust_goal_for_inflation(&gx, &gy)) {
            if (!find_free(&gx, &gy, search_radius)) {
                printf("A* Error: Cannot find free cell near goal!\n");
                return false;
            }
        }
    }

    astar_generation++;
    heap_size = 0;

    grid_init_cell(sx, sy);
    grid[sy][sx].g = 0;
    grid[sy][sx].f = heuristic(sx, sy, gx, gy);
    heap_push(sx, sy, grid[sy][sx].f);

    static const int dx8[8] = {-1, 0, 1, -1, 1, -1, 0, 1};
    static const int dy8[8] = {-1, -1, -1, 0, 0, 1, 1, 1};
    static const double cost8[8] = {1.41421356, 1.0, 1.41421356, 1.0, 1.0, 1.41421356, 1.0, 1.41421356};

    while (heap_size > 0) {
        HeapNode cur = heap_pop();
        int cx = cur.x, cy = cur.y;

        grid_init_cell(cx, cy);
        if (grid[cy][cx].closed) continue;
        grid[cy][cx].closed = true;

        if (cx == gx && cy == gy) {
            static Node tmp[MAX_PATH_STEPS];
            int len = 0, tx = gx, ty = gy;
            while ((tx != sx || ty != sy) && len < MAX_PATH_STEPS) {
                tmp[len].x = tx; tmp[len].y = ty; len++;
                int ppx = grid[ty][tx].px;
                int ppy = grid[ty][tx].py;
                tx = ppx; ty = ppy;
            }
            path_len = 0;
            for (int i = len - 1; i >= 0; i--)
                global_path[path_len++] = tmp[i];
            if (path_len == 0) return false;
            path_idx = 0;
            simplify_path();
            return true;
        }

        for (int d = 0; d < 8; d++) {
            int nx = cx + dx8[d], ny = cy + dy8[d];
            if (nx < 0 || nx >= MAP_SIZE_W || ny < 0 || ny >= MAP_SIZE_H) continue;
            if (!is_free(nx, ny)) continue;

            grid_init_cell(nx, ny);
            if (grid[ny][nx].closed) continue;

            double newg = grid[cy][cx].g + cost8[d];
            if (newg < grid[ny][nx].g) {
                grid[ny][nx].px = cx;
                grid[ny][nx].py = cy;
                grid[ny][nx].g = newg;
                grid[ny][nx].f = newg + heuristic(nx, ny, gx, gy);
                heap_push(nx, ny, grid[ny][nx].f);
            }
        }
    }
    return false;
}

// ------------------------------------------------------------
// DWA evaluation
// dist_to_final_goal: distance from robot to final target (not local waypoint)
// near_table: true when destination is a Table waypoint
double evaluate_trajectory(double v, double omega, double robot_x, double robot_y, double robot_theta,
                           double goal_x, double goal_y, double *lidar_ranges,
                           double dist_to_final_goal, bool near_table) {
    double x = robot_x, y = robot_y, th = robot_theta;
    int steps = (int)(PREDICT_TIME / DT);
    bool collision = false;
    for (int step = 0; step < steps; step++) {
        th += omega * DT;
        x += v * cos(th) * DT;
        y += v * sin(th) * DT;
        int mx, my;
        world_to_map(x, y, &mx, &my);
        if (!is_free(mx, my)) {
            collision = true;
            break;
        }
    }
    if (collision) return 1e6;

    // Clearance via distance transform — single lookup per sample point
    double clearance = LIDAR_MAX_RANGE;
    int steps_c = (int)(PREDICT_TIME / DT);
    double cx_c = robot_x, cy_c = robot_y, th_c = robot_theta;
    for (int sc = 0; sc <= steps_c; sc++) {
        int mx, my;
        world_to_map(cx_c, cy_c, &mx, &my);
        double d = dist_to_obstacle[my][mx] * MAP_RESOLUTION;
        if (d < clearance) clearance = d;
        th_c += omega * DT;
        cx_c += v * cos(th_c) * DT;
        cy_c += v * sin(th_c) * DT;
    }

    // Hard reject only at actual collision distance (3cm)
    // For near-table, allow even closer approach
    double hard_min = 0.03;
    if (near_table && dist_to_final_goal < 0.5) hard_min = 0.01;
    if (clearance < hard_min && fabs(v) > 0.01) return 1e6;

    // Goal heading cost
    double dx_goal = goal_x - x;
    double dy_goal = goal_y - y;
    double goal_dir = atan2(dy_goal, dx_goal);
    double heading_err = fabs(goal_dir - th);
    while (heading_err > M_PI) heading_err -= 2.0 * M_PI;
    heading_err = fabs(heading_err);

    double heading_cost = heading_err / M_PI;
    double vel_cost = 1.0 - (v / MAX_SPEED);

    // Soft clearance cost — steep penalty below OBSTACLE_MARGIN, normal above
    double clearance_cost;
    if (clearance < OBSTACLE_MARGIN) {
        clearance_cost = 1.0 + 3.0 * (1.0 - clearance / OBSTACLE_MARGIN);
    } else {
        clearance_cost = 1.0 - (clearance / LIDAR_MAX_RANGE);
    }

    double end_dist = hypot(goal_x - x, goal_y - y);
    double dist_cost = end_dist / 3.0;

    // Smoothness cost — penalize large omega changes from current
    double smooth_cost = fabs(omega - current_omega) / (2.0 * MAX_OMEGA);

    double w_heading = HEADING_GAIN;      // 0.3
    double w_clearance = CLEARANCE_GAIN;  // 0.25
    double w_vel = VEL_GAIN;              // 0.2
    double w_dist = 0.25;
    double w_smooth = SMOOTH_GAIN;        // 0.15

    if (near_table && dist_to_final_goal < 1.0) {
        w_heading = 0.6;
        w_clearance = 0.05;
        w_vel = 0.05;
        w_dist = 0.6;
        w_smooth = 0.05;
    } else if (near_table && dist_to_final_goal < 2.0) {
        w_heading = 0.4;
        w_clearance = 0.15;
        w_vel = 0.15;
        w_dist = 0.3;
        w_smooth = 0.10;
    }

    return w_heading * heading_cost + w_clearance * clearance_cost
         + w_vel * vel_cost + w_dist * dist_cost + w_smooth * smooth_cost;
}

void dwa_control(double robot_x, double robot_y, double robot_theta,
                 double goal_x, double goal_y, double *lidar_ranges,
                 double *out_v, double *out_omega,
                 double dist_to_final_goal, bool near_table) {
    double min_v = fmax(0.0, current_v - MAX_ACCEL * TIME_STEP / 1000.0);
    double max_v = fmin(MAX_SPEED, current_v + MAX_ACCEL * TIME_STEP / 1000.0);

    double dx = goal_x - robot_x;
    double dy = goal_y - robot_y;
    double target_th = atan2(dy, dx);
    double h_err = target_th - robot_theta;
    while (h_err > M_PI) h_err -= 2 * M_PI;
    while (h_err < -M_PI) h_err += 2 * M_PI;

    // Allow v=0 when heading error is moderate (>60°) so DWA can choose tight arcs
    if (fabs(h_err) > M_PI / 3.0) {
        min_v = 0.0;
    }

    if (near_table && dist_to_final_goal < 0.3) {
        min_v = fmax(0.0, current_v - MAX_ACCEL * TIME_STEP / 1000.0);
    }

    double min_omega = fmax(-MAX_OMEGA, current_omega - MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);
    double max_omega = fmin(MAX_OMEGA, current_omega + MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);

    double best_cost = INFINITY;
    double best_v = 0.0, best_omega = 0.0;
    int valid_samples = 0;
    int collision_samples = 0;
    int fallback_reason_logged = 0;

    for (int i = 0; i <= V_SAMPLES; i++) {
        double v = min_v + (max_v - min_v) * i / V_SAMPLES;
        for (int j = 0; j <= OMEGA_SAMPLES; j++) {
            double omega = min_omega + (max_omega - min_omega) * j / OMEGA_SAMPLES;
            double cost = evaluate_trajectory(v, omega, robot_x, robot_y, robot_theta,
                                               goal_x, goal_y, lidar_ranges,
                                               dist_to_final_goal, near_table);
            if (cost >= 0 && cost < best_cost) {
                best_cost = cost;
                best_v = v;
                best_omega = omega;
            }
            if (cost < 1e6) valid_samples++;
            else collision_samples++;
        }
    }

    if (best_cost == INFINITY || best_cost > 1000) {
        double check_dist = 0.3;
        double fx = robot_x + check_dist * cos(robot_theta);
        double fy = robot_y + check_dist * sin(robot_theta);
        int fmx, fmy;
        world_to_map(fx, fy, &fmx, &fmy);
        bool front_blocked = !is_free(fmx, fmy);
        double dx = goal_x - robot_x;
        double dy = goal_y - robot_y;
        double target_th = atan2(dy, dx);
        double err = target_th - robot_theta;
        while (err > M_PI) err -= 2 * M_PI;
        while (err < -M_PI) err += 2 * M_PI;

        if (front_blocked) {
            best_v = 0.0;
            best_omega = (fabs(err) > 0.15) ? fmax(-0.8, fmin(0.8, err * 1.5)) : 0.0;
            if (fallback_reason_logged++ == 0) {
                printf("DWA fallback: front blocked, rotating in place. err=%.3f goal=(%.2f,%.2f) front_cell=(%d,%d)\n",
                       err, goal_x, goal_y, fmx, fmy);
            }
        } else {
            best_v = 0.0;
            best_omega = fmax(-MAX_OMEGA, fmin(MAX_OMEGA, err * 1.5));
            if (fallback_reason_logged++ == 0) {
                printf("DWA fallback: all samples blocked, rotate first. err=%.3f goal=(%.2f,%.2f)\n",
                       err, goal_x, goal_y);
            }
        }
    }

    // If the chosen action is almost pure rotation, do not force forward motion.
    if (fabs(best_v) < 0.03) {
        best_v = 0.0;
    }

    // Post-filter: clamp omega change to OMEGA_SMOOTH_MAX per step
    double omega_delta = best_omega - current_omega;
    if (omega_delta > OMEGA_SMOOTH_MAX) omega_delta = OMEGA_SMOOTH_MAX;
    if (omega_delta < -OMEGA_SMOOTH_MAX) omega_delta = -OMEGA_SMOOTH_MAX;
    best_omega = current_omega + omega_delta;

    if ((dwa_debug_tick++ % 10) == 0) {
        int gmx, gmy;
        world_to_map(goal_x, goal_y, &gmx, &gmy);
        printf("DWA debug: robot=(%.2f,%.2f,th=%.2f) goal=(%.2f,%.2f) map_goal=(%d,%d) v_range=[%.2f,%.2f] w_range=[%.2f,%.2f] valid=%d blocked=%d best=(%.2f,%.2f) cost=%.3f dist=%.3f near_table=%d\n",
               robot_x, robot_y, robot_theta,
               goal_x, goal_y, gmx, gmy,
               min_v, max_v, min_omega, max_omega,
               valid_samples, collision_samples,
               best_v, best_omega, best_cost, dist_to_final_goal,
               near_table ? 1 : 0);
    }

    *out_v = best_v;
    *out_omega = best_omega;
}

void compute_wheel_speeds(double v, double omega, double *vl, double *vr) {
    *vl = (v - (omega * WHEEL_BASE / 2.0)) / WHEEL_RADIUS;
    *vr = (v + (omega * WHEEL_BASE / 2.0)) / WHEEL_RADIUS;
}

void load_wp(Waypoint *wps, int *num) {
    FILE *fp = fopen("waypoints.txt", "r");
    if (!fp) return;
    char line[128];
    *num = 0;
    while (fgets(line, sizeof(line), fp)) {
        if (*num >= MAX_WAYPOINTS) break;
        char name[64];
        double x, y;
        if (sscanf(line, "%[^:]: %lf %lf", name, &x, &y) == 3) {
            snprintf(wps[*num].name, sizeof(wps[*num].name), "%s", name);
            wps[*num].x = x;
            wps[*num].y = y;
            wps[*num].valid = true;
            (*num)++;
        }
    }
    fclose(fp);
}

// ------------------------------------------------------------
int main(int argc, char **argv) {
    wb_robot_init();
    if (!load_map("map.pgm")) {
        if (!load_map("map_nhahang.pgm")) {
            printf("Failed to load map.\n");
            return -1;
        }
    }
    init_dynamic_map();
    compute_distance_transform();

    WbDeviceTag left_motor = wb_robot_get_device("left wheel");
    WbDeviceTag right_motor = wb_robot_get_device("right wheel");
    WbDeviceTag left_enc = wb_robot_get_device("left wheel sensor");
    WbDeviceTag right_enc = wb_robot_get_device("right wheel sensor");
    wb_motor_set_position(left_motor, INFINITY);
    wb_motor_set_position(right_motor, INFINITY);
    wb_motor_set_velocity(left_motor, 0.0);
    wb_motor_set_velocity(right_motor, 0.0);
    wb_position_sensor_enable(left_enc, TIME_STEP);
    wb_position_sensor_enable(right_enc, TIME_STEP);

    lidar = wb_robot_get_device("Sick LMS 291");
    if (lidar == 0) lidar = wb_robot_get_device("lidar");
    if (lidar == 0) lidar = wb_robot_get_device("LDS-01");
    if (lidar != 0) {
        wb_lidar_enable(lidar, TIME_STEP);
        wb_lidar_enable_point_cloud(lidar);
        lidar_fov = wb_lidar_get_fov(lidar);
        lidar_actual_count = wb_lidar_get_number_of_points(lidar);
        if (lidar_actual_count > LIDAR_MAX_SAMPLES) lidar_actual_count = LIDAR_MAX_SAMPLES;
        printf("Lidar: %d points, FOV = %.1f deg\n", lidar_actual_count, lidar_fov * 180.0 / M_PI);
    }

    wb_keyboard_enable(TIME_STEP);

    double robot_x = 0.0, robot_y = 0.0, robot_theta = 0.0;
    double last_left = 0.0, last_right = 0.0;

    WbDeviceTag gps = wb_robot_get_device("gps");
    if (gps != 0) {
        wb_gps_enable(gps, TIME_STEP);
    }
    WbDeviceTag iu = wb_robot_get_device("inertial_unit");
    if (iu != 0) {
        wb_inertial_unit_enable(iu, TIME_STEP);
    }

    wb_robot_step(TIME_STEP);
    last_left = wb_position_sensor_get_value(left_enc);
    last_right = wb_position_sensor_get_value(right_enc);

    load_wp(waypoints, &num_waypoints);
    if (!parse_graph_json("graph.json")) {
        printf("Graph load fallback: using legacy waypoints.txt\n");
    }

    // Đọc điểm xuất phát từ meta
    start_x = 0.0;
    start_y = 0.0;
    load_meta(&start_x, &start_y);

    // Lấy vị trí ban đầu từ GPS hoặc odometry
    if (gps != 0) {
        const double *gps_vals = wb_gps_get_values(gps);
        if (gps_vals && isfinite(gps_vals[0]) && isfinite(gps_vals[1])) {
            robot_x = gps_vals[0];
            robot_y = gps_vals[1];
            printf("GPS initial position: (%.4f, %.4f)\n", robot_x, robot_y);
        } else {
            robot_x = start_x;
            robot_y = start_y;
        }
    } else {
        robot_x = start_x;
        robot_y = start_y;
    }

    if (iu != 0) {
        const double *rpy = wb_inertial_unit_get_roll_pitch_yaw(iu);
        if (rpy && isfinite(rpy[2])) {
            robot_theta = rpy[2];
            printf("InertialUnit initial yaw: %.4f rad\n", robot_theta);
        } else {
            robot_theta = 0.0;
        }
    } else {
        robot_theta = 0.0;
    }

    // =============================================================
    // TỰ ĐỘNG ĐI ĐẾN ĐIỂM XUẤT PHÁT KHI RUN (nếu chưa ở đó)
    // =============================================================
    double dist_to_start = hypot(robot_x - start_x, robot_y - start_y);
    if (dist_to_start < 0.1) {
        target_x = robot_x;
        target_y = robot_y;
        target_received = false;
        robot_state = STATE_IDLE;
        printf("Robot already at start point (%.2f, %.2f). Waiting for commands.\n", start_x, start_y);
    } else {
        target_x = start_x;
        target_y = start_y;
        target_received = true;
        has_path = false;
        robot_state = STATE_RETURN_TO_KITCHEN;
        printf("Auto navigating to start point (%.2f, %.2f) ...\n", start_x, start_y);
    }

    printf("=== Phase 3 DWA OK - He thong da san sang ===\n");

    while (wb_robot_step(TIME_STEP) != -1) {
        // Update position from GPS and InertialUnit if available, otherwise fallback to Odometry
        bool pos_updated = false;
        if (gps != 0) {
            const double *gps_vals = wb_gps_get_values(gps);
            if (gps_vals && isfinite(gps_vals[0]) && isfinite(gps_vals[1])) {
                robot_x = gps_vals[0];
                robot_y = gps_vals[1];
                pos_updated = true;
            }
        }
        if (iu != 0) {
            const double *rpy = wb_inertial_unit_get_roll_pitch_yaw(iu);
            if (rpy && isfinite(rpy[2])) {
                robot_theta = rpy[2];
            }
        }

        if (!pos_updated) {
            // Odometry fallback
            double left = wb_position_sensor_get_value(left_enc);
            double right = wb_position_sensor_get_value(right_enc);
            double dleft = left - last_left;
            double dright = right - last_right;
            if (isfinite(dleft) && isfinite(dright) && fabs(dleft) < 5.0 && fabs(dright) < 5.0) {
                last_left = left;
                last_right = right;
                double dl = dleft * WHEEL_RADIUS;
                double dr = dright * WHEEL_RADIUS;
                double dc = (dl + dr) / 2.0;
                double dth = (dr - dl) / WHEEL_BASE;
                robot_x += dc * cos(robot_theta + dth / 2.0);
                robot_y += dc * sin(robot_theta + dth / 2.0);
                robot_theta += dth;
                while (robot_theta > M_PI) robot_theta -= 2 * M_PI;
                while (robot_theta < -M_PI) robot_theta += 2 * M_PI;
            }
        } else {
            // Keep encoder history updated so fallback works if needed
            last_left = wb_position_sensor_get_value(left_enc);
            last_right = wb_position_sensor_get_value(right_enc);
        }

        // 1. Đọc lệnh từ UI gửi qua command.txt
        double manual_v = 0.0, manual_omega = 0.0;
        read_robot_command(&target_x, &target_y, &target_received, &has_path, &robot_state, left_motor, right_motor, &manual_v, &manual_omega);

        if (robot_state == STATE_MANUAL_MOVE) {
            current_v = manual_v;
            current_omega = manual_omega;
            double vl, vr;
            compute_wheel_speeds(current_v, current_omega, &vl, &vr);
            vl = fmin(fmax(vl, -MAX_SPEED), MAX_SPEED);
            vr = fmin(fmax(vr, -MAX_SPEED), MAX_SPEED);
            wb_motor_set_velocity(left_motor, vl);
            wb_motor_set_velocity(right_motor, vr);

            write_robot_state(robot_x, robot_y, robot_theta, current_v, current_omega, get_state_string(robot_state));
            continue;
        }

        // Lidar — read all available points and update dynamic obstacle map
        if (lidar != 0) {
            const float *ranges = wb_lidar_get_range_image(lidar);
            if (ranges) {
                int n = wb_lidar_get_number_of_points(lidar);
                int samples = (n < LIDAR_MAX_SAMPLES) ? n : LIDAR_MAX_SAMPLES;
                lidar_actual_count = samples;
                for (int i = 0; i < samples; i++) {
                    lidar_ranges[i] = ranges[i];
                    if (lidar_ranges[i] < 0.05) lidar_ranges[i] = 0.05;
                }
                for (int i = samples; i < LIDAR_MAX_SAMPLES; i++) lidar_ranges[i] = LIDAR_MAX_RANGE;

                update_dynamic_map_from_lidar(robot_x, robot_y, robot_theta,
                                               lidar_ranges, lidar_actual_count, lidar_fov);
                compute_distance_transform();
            }
        }

        // Re-plan if dynamic obstacle blocks current path
        {
            static int replan_counter = 0;
            if (has_path && ++replan_counter >= REPLAN_CHECK_INTERVAL) {
                replan_counter = 0;
                if (check_path_blocked_by_dynamic()) {
                    printf("Dynamic obstacle on path! Re-planning...\n");
                    has_path = false;
                    if (path_is_graph) {
                        graph_path_active = true;
                        graph_route_requested = true;
                    }
                }
            }
        }

        // Keyboard input (chỉ giữ phím số để đi đến bàn, đã bỏ phím S)
        int key = wb_keyboard_get_key();
        if (key >= '1' && key <= '9') {
            int idx = key - '1';
            if (idx < num_waypoints && waypoints[idx].valid) {
                target_x = waypoints[idx].x;
                target_y = waypoints[idx].y;
                target_received = true;
                has_path = false;
                robot_state = STATE_NAV_TO_TABLE;
                strncpy(current_target_name, waypoints[idx].name, sizeof(current_target_name) - 1);
                current_target_name[sizeof(current_target_name) - 1] = '\0';
                printf("Go to %s: (%.2f, %.2f)\n", waypoints[idx].name, target_x, target_y);
            } else if (num_waypoints == 0 && (key == '1' || key == '2')) {
                target_x = (key == '1') ? robot_x : -0.8;
                target_y = (key == '1') ? robot_y : 1.5;
                target_received = true;
                has_path = false;
                robot_state = STATE_NAV_TO_TABLE;
                printf("Default target: (%.2f, %.2f)\n", target_x, target_y);
            }
        }

        // Global path planning
        if (target_received && !has_path) {
            double dist_to_goal = hypot(target_x - robot_x, target_y - robot_y);
            double stop_dist = get_stopping_distance();
            if (dist_to_goal < stop_dist) {
                target_received = false;
                has_path = false;
                path_is_graph = false;
                robot_state = STATE_IDLE;
                printf("\n========== ARRIVED (already at goal, d=%.3f < %.3f) ==========\n",
                       dist_to_goal, stop_dist);
                current_v = 0.0; current_omega = 0.0;
                wb_motor_set_velocity(left_motor, 0.0);
                wb_motor_set_velocity(right_motor, 0.0);
                clear_path_file();
                write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                continue;
            }

            if (!graph_route_requested) {
                graph_route_requested = true;
            }

            int goal_node_idx = find_graph_node_index_by_name_or_id(current_target_name);
            int start_node_idx = find_nearest_graph_node(robot_x, robot_y);
            graph_route_requested = false;
            graph_route_len = 0;
            graph_path_active = false;

            if (goal_node_idx >= 0 && start_node_idx >= 0) {
                build_graph_route_from_indices(start_node_idx, goal_node_idx);
            }

            if (graph_path_active && graph_route_len > 0) {
                has_path = true;
                path_is_graph = true;
                path_len = graph_route_len;
                path_idx = 0;
                for (int i = 0; i < graph_route_len && path_len < MAX_PATH_STEPS; i++) {
                    global_path[i].x = graph_route[i];
                    global_path[i].y = -1;
                }
                printf("Graph path activated: %d nodes.\n", graph_route_len);
                write_path_to_file(robot_x, robot_y);
                graph_path_active = false;
            } else {
                target_received = false;
                has_path = false;
                path_is_graph = false;
                printf("No graph path! Cannot reach target (%.2f, %.2f).\n", target_x, target_y);
                clear_path_file();
                continue;
            }
        }

        // ============================================================
        // Distance to FINAL target (for dynamic stopping & DWA tuning)
        double dist_to_final = hypot(target_x - robot_x, target_y - robot_y);
        double stop_dist = get_stopping_distance();
        bool near_table = is_table_target();

        // ============================================================
        // Xác định local_goal và cập nhật waypoint/segment
        double local_goal_x = target_x, local_goal_y = target_y;
        if (has_path && path_idx < path_len) {
            if (!path_is_graph) {
                has_path = false;
                target_received = false;
                robot_state = STATE_IDLE;
                path_len = 0;
                path_idx = 0;
                graph_route_len = 0;
                graph_route_requested = false;
                graph_path_active = false;
                clear_path_file();
                continue;
            }

            int current_node_idx = global_path[path_idx].x;
            if (current_node_idx < 0 || current_node_idx >= num_graph_nodes || !graph_nodes[current_node_idx].valid) {
                has_path = false;
                target_received = false;
                robot_state = STATE_IDLE;
                path_is_graph = false;
                path_len = 0;
                path_idx = 0;
                graph_route_len = 0;
                graph_route_requested = false;
                graph_path_active = false;
                clear_path_file();
                continue;
            }

            int next_node_idx = (path_idx + 1 < path_len) ? global_path[path_idx + 1].x : current_node_idx;
            if (next_node_idx < 0 || next_node_idx >= num_graph_nodes || !graph_nodes[next_node_idx].valid) {
                next_node_idx = current_node_idx;
            }

            double current_wp_x = graph_nodes[current_node_idx].x;
            double current_wp_y = graph_nodes[current_node_idx].y;
            double next_wp_x = graph_nodes[next_node_idx].x;
            double next_wp_y = graph_nodes[next_node_idx].y;
            double seg_x = next_wp_x - current_wp_x;
            double seg_y = next_wp_y - current_wp_y;
            double seg_len = hypot(seg_x, seg_y);
            double dist_to_current = hypot(current_wp_x - robot_x, current_wp_y - robot_y);
            bool is_last_wp = (path_idx >= path_len - 1);
            double wp_accept = is_last_wp ? stop_dist : WAYPOINT_ACCEPT_DIST;
            bool velocity_stopped = is_velocity_near_zero(current_v, current_omega);
            bool final_arrived = false;

            if (is_last_wp) {
                if (dist_to_final < stop_dist) {
                    final_arrived = true;
                } else if (near_table && dist_to_final < 0.15 && velocity_stopped) {
                    final_arrived = true;
                    printf("Table arrival: DWA decelerated, d=%.3f v=%.4f\n", dist_to_final, current_v);
                }
            }

            if (dist_to_current < wp_accept || final_arrived) {
                if (is_last_wp || final_arrived) {
                    has_path = false;
                    target_received = false;
                    robot_state = STATE_IDLE;
                    path_is_graph = false;
                    path_len = 0;
                    path_idx = 0;
                    graph_route_len = 0;
                    graph_route_requested = false;
                    graph_path_active = false;
                    printf("\n========== ARRIVED (d=%.3f, threshold=%.3f) ==========\n", dist_to_final, stop_dist);
                    current_v = 0.0;
                    current_omega = 0.0;
                    wb_motor_set_velocity(left_motor, 0.0);
                    wb_motor_set_velocity(right_motor, 0.0);
                    clear_path_file();
                    write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                    continue;
                }
                path_idx++;
                continue;
            }

            double proj_t = 0.0;
            if (seg_len > 0.001) {
                double rx = robot_x - current_wp_x;
                double ry = robot_y - current_wp_y;
                proj_t = (rx * seg_x + ry * seg_y) / (seg_len * seg_len);
            }
            if (proj_t < 0.0) proj_t = 0.0;
            if (proj_t > 1.0) proj_t = 1.0;

            if (path_idx < path_len - 1) {
                double advance_threshold = near_table ? 0.75 : 0.6;
                if (proj_t > advance_threshold) {
                    path_idx++;
                    continue;
                }
            }

            if (seg_len > 0.001) {
                double progress_goal = proj_t + 0.35;
                if (progress_goal > 1.0) progress_goal = 1.0;
                local_goal_x = current_wp_x + seg_x * progress_goal;
                local_goal_y = current_wp_y + seg_y * progress_goal;
            } else {
                local_goal_x = next_wp_x;
                local_goal_y = next_wp_y;
            }

            if (near_table && dist_to_final < 0.5) {
                local_goal_x = target_x;
                local_goal_y = target_y;
            }

            if (check_path_blocked_by_dynamic()) {
                printf("Graph segment blocked, requesting re-route.\n");
                graph_route_requested = true;
                graph_path_active = true;
                has_path = false;
                path_is_graph = false;
                path_len = 0;
                path_idx = 0;
                continue;
            }
        } else if (!has_path && target_received) {
            local_goal_x = target_x;
            local_goal_y = target_y;
        } else {
            current_v = 0.0;
            current_omega = 0.0;
            wb_motor_set_velocity(left_motor, 0.0);
            wb_motor_set_velocity(right_motor, 0.0);
            write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
            continue;
        }

        local_goal_x = fmin(fmax(local_goal_x, -9.9), 9.9);
        local_goal_y = fmin(fmax(local_goal_y, -9.9), 9.9);

        double cmd_v, cmd_omega;
        dwa_control(robot_x, robot_y, robot_theta, local_goal_x, local_goal_y,
                    lidar_ranges, &cmd_v, &cmd_omega,
                    dist_to_final, near_table);
        current_v = cmd_v;
        current_omega = cmd_omega;
        double vl, vr;
        compute_wheel_speeds(current_v, current_omega, &vl, &vr);
        vl = fmin(fmax(vl, -MAX_SPEED), MAX_SPEED);
        vr = fmin(fmax(vr, -MAX_SPEED), MAX_SPEED);
        wb_motor_set_velocity(left_motor, vl);
        wb_motor_set_velocity(right_motor, vr);

        write_robot_state(robot_x, robot_y, robot_theta, current_v, current_omega, get_state_string(robot_state));

        static int pc = 0;
        if (pc++ % 15 == 0) {
            printf("Pos: (%.2f,%.2f) th=%.2f v=%.2f w=%.2f goal=(%.2f,%.2f) final_d=%.3f %s\n",
                   robot_x, robot_y, robot_theta, current_v, current_omega,
                   local_goal_x, local_goal_y, dist_to_final,
                   near_table ? "[TABLE]" : "");
        }
    }
    wb_robot_cleanup();
    return 0;
}