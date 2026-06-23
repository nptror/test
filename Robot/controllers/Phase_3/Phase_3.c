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
#define PREDICT_TIME 1.2
#define HEADING_GAIN 0.5
#define CLEARANCE_GAIN 0.25
#define VEL_GAIN 0.25
#define OBSTACLE_MARGIN 0.15
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

enum RobotState {
    STATE_IDLE,
    STATE_NAV_TO_TABLE,
    STATE_MANUAL_MOVE,
    STATE_RETURN_TO_KITCHEN
};
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

    char *px = strstr(buf, "\"robot_start_x\"");
    if (px) {
        px = strchr(px, ':');
        if (px) sscanf(px + 1, "%lf", start_x);
    }
    char *py = strstr(buf, "\"robot_start_y\"");
    if (py) {
        py = strchr(py, ':');
        if (py) sscanf(py + 1, "%lf", start_y);
    }
    printf("Loaded robot start position from meta: (%.2f, %.2f)\n", *start_x, *start_y);
}

// Ghi planned path ra file để UI hiển thị
void write_path_to_file(double robot_x, double robot_y) {
    FILE *fp = fopen("robot_path.txt", "w");
    if (!fp) return;
    fprintf(fp, "%.4f %.4f\n", robot_x, robot_y);
    for (int i = 0; i < path_len; i++) {
        double wx, wy;
        map_to_world(global_path[i].x, global_path[i].y, &wx, &wy);
        fprintf(fp, "%.4f %.4f\n", wx, wy);
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
            if (strcmp(target, "robotStart") == 0 || strcmp(target, "START") == 0) {
                *target_x = start_x;
                *target_y = start_y;
                *target_received = true;
                *has_path = false;
                *state = STATE_RETURN_TO_KITCHEN;
                strncpy(current_target_name, "robotStart", sizeof(current_target_name) - 1);
                printf("Command: NAV_TO_TABLE -> START (%.2f, %.2f)\n", *target_x, *target_y);
            } else {
                for (int i = 0; i < num_waypoints; i++) {
                    if (waypoints[i].valid && strcmp(waypoints[i].name, target) == 0) {
                        *target_x = waypoints[i].x;
                        *target_y = waypoints[i].y;
                        *target_received = true;
                        *has_path = false;
                        *state = STATE_NAV_TO_TABLE;
                        strncpy(current_target_name, waypoints[i].name, sizeof(current_target_name) - 1);
                        current_target_name[sizeof(current_target_name) - 1] = '\0';
                        printf("Command: NAV_TO_TABLE -> %s (%.2f, %.2f)\n", target, *target_x, *target_y);
                        break;
                    }
                }
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
// Đọc waypoints từ file
void load_wp(Waypoint *wp, int *cnt) {
    FILE *fp = fopen("waypoints.txt", "r");
    *cnt = 0;
    if (!fp) {
        printf("No waypoints.txt - using default (1.0,0.8) and (-0.8,1.5)\n");
        return;
    }
    char line[256];
    while (fgets(line, 256, fp) && *cnt < MAX_WAYPOINTS) {
        char name[64];
        double x, y;
        if (sscanf(line, "%[^:]: %lf %lf", name, &x, &y) == 3) {
            strncpy(wp[*cnt].name, name, sizeof(wp[*cnt].name) - 1);
            wp[*cnt].name[sizeof(wp[*cnt].name) - 1] = '\0';
            wp[*cnt].x = x;
            wp[*cnt].y = y;
            wp[*cnt].theta = 0.0;
            wp[*cnt].valid = true;
            (*cnt)++;
        } else if (sscanf(line, "%lf %lf", &x, &y) == 2) {
            snprintf(wp[*cnt].name, sizeof(wp[*cnt].name), "Waypoint_%d", *cnt + 1);
            wp[*cnt].x = x;
            wp[*cnt].y = y;
            wp[*cnt].theta = 0.0;
            wp[*cnt].valid = true;
            (*cnt)++;
        }
    }
    fclose(fp);
    printf("Loaded %d waypoints.\n", *cnt);
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

    // Clear robot's own footprint so it doesn't block itself
    int rmx, rmy;
    world_to_map(robot_x, robot_y, &rmx, &rmy);
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
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
        if (px >= 0 && px < MAP_SIZE_W && py >= 0 && py < MAP_SIZE_H) {
            if (dynamic_map[py][px] < DYNAMIC_OBSTACLE_THRESHOLD) {
                return true;
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

    // Hard clearance threshold — relaxed when approaching a table at close range
    double min_clearance = OBSTACLE_MARGIN; // default 0.15m
    if (near_table && dist_to_final_goal < 0.5) {
        // Close to table delivery point: allow robot to come within 3cm of obstacles
        min_clearance = 0.03;
    } else if (near_table && dist_to_final_goal < 1.0) {
        min_clearance = 0.08;
    }
    if (clearance < min_clearance) return 1e6;

    // Goal heading cost
    double dx_goal = goal_x - x;
    double dy_goal = goal_y - y;
    double goal_dir = atan2(dy_goal, dx_goal);
    double heading_err = fabs(goal_dir - th);
    while (heading_err > M_PI) heading_err -= 2.0 * M_PI;
    heading_err = fabs(heading_err);

    double heading_cost = heading_err / M_PI;
    double vel_cost = 1.0 - (v / MAX_SPEED);
    double clearance_cost = 1.0 - (clearance / LIDAR_MAX_RANGE);

    // Distance to goal cost — reward trajectories that end closer to the target
    double end_dist = hypot(goal_x - x, goal_y - y);
    double dist_cost = end_dist / 3.0; // normalize by reasonable range

    // Dynamic weight adjustment based on proximity to table target
    double w_heading = HEADING_GAIN;    // 0.5
    double w_clearance = CLEARANCE_GAIN; // 0.25
    double w_vel = VEL_GAIN;            // 0.25
    double w_dist = 0.0;

    if (near_table && dist_to_final_goal < 1.0) {
        // Near table: prioritize reaching the goal over obstacle avoidance
        w_heading = 0.8;
        w_clearance = 0.05;
        w_vel = 0.05;
        w_dist = 0.6;
    } else if (near_table && dist_to_final_goal < 2.0) {
        w_heading = 0.6;
        w_clearance = 0.15;
        w_vel = 0.15;
        w_dist = 0.3;
    }

    return w_heading * heading_cost + w_clearance * clearance_cost
         + w_vel * vel_cost + w_dist * dist_cost;
}

void dwa_control(double robot_x, double robot_y, double robot_theta,
                 double goal_x, double goal_y, double *lidar_ranges,
                 double *out_v, double *out_omega,
                 double dist_to_final_goal, bool near_table) {
    double min_v = fmax(0.1, current_v - MAX_ACCEL * TIME_STEP / 1000.0);
    double max_v = fmin(MAX_SPEED, current_v + MAX_ACCEL * TIME_STEP / 1000.0);

    // When very close to a table target, allow lower min velocity for fine approach
    if (near_table && dist_to_final_goal < 0.3) {
        min_v = fmax(0.02, current_v - MAX_ACCEL * TIME_STEP / 1000.0);
    }

    double min_omega = fmax(-MAX_OMEGA, current_omega - MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);
    double max_omega = fmin(MAX_OMEGA, current_omega + MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);

    double best_cost = INFINITY;
    double best_v = 0.0, best_omega = 0.0;

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
        }
    }

    if (best_cost == INFINITY || best_cost > 1000) {
        // Check if dynamic obstacles are blocking the forward direction
        double check_dist = 0.3;
        double fx = robot_x + check_dist * cos(robot_theta);
        double fy = robot_y + check_dist * sin(robot_theta);
        int fmx, fmy;
        world_to_map(fx, fy, &fmx, &fmy);
        bool front_blocked = !is_free(fmx, fmy);

        if (front_blocked) {
            best_v = 0.0;
            best_omega = 0.0;
            printf("DWA: all trajectories blocked, stopping for safety.\n");
        } else {
            best_v = 0.2;
            double dx = goal_x - robot_x;
            double dy = goal_y - robot_y;
            double target_th = atan2(dy, dx);
            double err = target_th - robot_theta;
            while (err > M_PI) err -= 2 * M_PI;
            while (err < -M_PI) err += 2 * M_PI;
            best_omega = (err > 0) ? 0.5 : -0.5;
        }
    }

    *out_v = best_v;
    *out_omega = best_omega;
}

void compute_wheel_speeds(double v, double omega, double *vl, double *vr) {
    *vl = (v - (omega * WHEEL_BASE / 2.0)) / WHEEL_RADIUS;
    *vr = (v + (omega * WHEEL_BASE / 2.0)) / WHEEL_RADIUS;
}

// ------------------------------------------------------------
int main(int argc, char **argv) {
    wb_robot_init();
    if (!load_map("map_nhahang.pgm")) {
        printf("Failed to load map.\n");
        return -1;
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

            int sx, sy, gx, gy;
            world_to_map(robot_x, robot_y, &sx, &sy);
            world_to_map(target_x, target_y, &gx, &gy);

            // Nếu start và goal cùng ô pixel, coi như đã đến
            if (sx == gx && sy == gy) {
                target_received = false;
                has_path = false;
                robot_state = STATE_IDLE;
                printf("\n========== ARRIVED (same cell) ==========\n");
                current_v = 0.0; current_omega = 0.0;
                wb_motor_set_velocity(left_motor, 0.0);
                wb_motor_set_velocity(right_motor, 0.0);
                clear_path_file();
                write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                continue;
            }

            if (plan_path(sx, sy, gx, gy)) {
                printf("Path found, %d waypoints.\n", path_len);
                has_path = true;
                write_path_to_file(robot_x, robot_y);
            } else {
                target_received = false;
                printf("No path! Cannot reach target (%.2f, %.2f).\n", target_x, target_y);
                clear_path_file();
            }
        }

        // ============================================================
        // Distance to FINAL target (for dynamic stopping & DWA tuning)
        double dist_to_final = hypot(target_x - robot_x, target_y - robot_y);
        double stop_dist = get_stopping_distance();
        bool near_table = is_table_target();

        // ============================================================
        // Xác định local_goal và cập nhật waypoint
        double local_goal_x = target_x, local_goal_y = target_y;
        if (has_path && path_idx < path_len) {
            int wx = global_path[path_idx].x;
            int wy = global_path[path_idx].y;
            double current_wp_x, current_wp_y;
            map_to_world(wx, wy, &current_wp_x, &current_wp_y);
            double dist_to_current = hypot(current_wp_x - robot_x, current_wp_y - robot_y);

            // For intermediate waypoints: use generous accept distance
            // For the LAST waypoint: use dynamic stopping distance
            bool is_last_wp = (path_idx >= path_len - 1);
            double wp_accept = is_last_wp ? stop_dist : WAYPOINT_ACCEPT_DIST;

            // Table final arrival: also check velocity (DWA deceleration)
            bool velocity_stopped = is_velocity_near_zero(current_v, current_omega);
            bool final_arrived = false;

            if (is_last_wp) {
                if (dist_to_final < stop_dist) {
                    final_arrived = true;
                } else if (near_table && dist_to_final < 0.15 && velocity_stopped) {
                    // DWA has decelerated to near-zero near a table — accept arrival
                    final_arrived = true;
                    printf("Table arrival: DWA decelerated, d=%.3f v=%.4f\n",
                           dist_to_final, current_v);
                }
            }

            if (dist_to_current < wp_accept || final_arrived) {
                if (is_last_wp || final_arrived) {
                    has_path = false;
                    target_received = false;
                    robot_state = STATE_IDLE;
                    printf("\n========== ARRIVED (d=%.3f, threshold=%.3f) ==========\n",
                           dist_to_final, stop_dist);
                    current_v = 0;
                    current_omega = 0;
                    wb_motor_set_velocity(left_motor, 0);
                    wb_motor_set_velocity(right_motor, 0);
                    clear_path_file();
                    write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                    continue;
                } else {
                    path_idx++;
                    continue;
                }
            }

            // Segment-based advancement for intermediate waypoints only
            bool should_advance = false;
            if (path_idx < path_len - 1) {
                int next_wx = global_path[path_idx + 1].x;
                int next_wy = global_path[path_idx + 1].y;
                double next_wp_x, next_wp_y;
                map_to_world(next_wx, next_wy, &next_wp_x, &next_wp_y);
                double seg_x = next_wp_x - current_wp_x;
                double seg_y = next_wp_y - current_wp_y;
                double seg_len = hypot(seg_x, seg_y);
                if (seg_len > 0.001) {
                    double rx = robot_x - current_wp_x;
                    double ry = robot_y - current_wp_y;
                    double dot = rx * seg_x + ry * seg_y;
                    if (dot > 0.5 * seg_len * seg_len) {
                        should_advance = true;
                    }
                }
            }

            if (should_advance && path_idx < path_len - 1) {
                path_idx++;
                continue;
            }

            // Look-ahead: when close to final target on a table, reduce look-ahead
            // so DWA aims precisely at the delivery pin
            int look_ahead = 4;
            if (near_table && dist_to_final < 0.5) {
                look_ahead = 1;
            } else if (near_table && dist_to_final < 1.0) {
                look_ahead = 2;
            }
            int look_ahead_idx = path_idx + look_ahead;
            if (look_ahead_idx >= path_len) look_ahead_idx = path_len - 1;

            // When on the last few waypoints near a table, use the actual target
            // coordinates instead of the map-quantized waypoint for precision
            if (near_table && look_ahead_idx >= path_len - 2 && dist_to_final < 0.5) {
                local_goal_x = target_x;
                local_goal_y = target_y;
            } else {
                int nwx = global_path[look_ahead_idx].x;
                int nwy = global_path[look_ahead_idx].y;
                map_to_world(nwx, nwy, &local_goal_x, &local_goal_y);
            }

        } else if (!has_path && target_received) {
            local_goal_x = target_x;
            local_goal_y = target_y;
        } else {
            current_v = 0.0;
            current_omega = 0.0;
            wb_motor_set_velocity(left_motor, 0);
            wb_motor_set_velocity(right_motor, 0);
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