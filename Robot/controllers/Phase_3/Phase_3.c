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

#define MAX_PATH_STEPS 10000
#define WAYPOINT_ACCEPT_DIST 0.3
#define MAX_WAYPOINTS 20

// Lidar parameters
#define LIDAR_NUM_SAMPLES 18
#define LIDAR_MAX_RANGE 3.0

// Dynamic map - maximum supported dimension
#define MAX_MAP_DIM 1000
unsigned char static_map[MAX_MAP_DIM][MAX_MAP_DIM];
int MAP_SIZE_W = 400;
int MAP_SIZE_H = 400;
double MAP_RESOLUTION = 0.05;

// A* grid
typedef struct { int x, y; double g, f; int px, py; bool closed; } AStarNode;
AStarNode grid[MAX_MAP_DIM][MAX_MAP_DIM];

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
#define HEAP_MAX 40000
typedef struct { int x, y; double f; } HeapNode;
HeapNode heap[HEAP_MAX];
int heap_size = 0;

Node global_path[MAX_PATH_STEPS];
int path_len = 0, path_idx = 0;
bool has_path = false, target_received = false;
double target_x = 0.0, target_y = 0.0;
double start_x = 0.0, start_y = 0.0;

double current_v = 0.0, current_omega = 0.0;

WbDeviceTag lidar;
double lidar_ranges[LIDAR_NUM_SAMPLES];
Waypoint waypoints[MAX_WAYPOINTS];
int num_waypoints = 0;

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
    return hypot(x1 - x2, y1 - y2);
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
    return (static_map[y][x] >= 128);
}

// SỬA LỖI: đổi tên biến lặp thành xx, yy để không che khuất tham số con trỏ
bool find_free(int *x, int *y, int r) {
    if (is_free(*x, *y)) return true;
    for (int rad = 1; rad <= r; rad++) {
        for (int dx = -rad; dx <= rad; dx++) {
            for (int dy = -rad; dy <= rad; dy++) {
                int nx = *x + dx, ny = *y + dy;
                if (is_free(nx, ny)) {
                    *x = nx; *y = ny;
                    return true;
                }
            }
        }
    }
    // Nếu không tìm thấy trong bán kính, duyệt toàn bộ map
    for (int yy = 0; yy < MAP_SIZE_H; yy++) {
        for (int xx = 0; xx < MAP_SIZE_W; xx++) {
            if (is_free(xx, yy)) {
                *x = xx;
                *y = yy;
                return true;
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
                printf("Command: NAV_TO_TABLE -> START (%.2f, %.2f)\n", *target_x, *target_y);
            } else {
                // Tìm waypoint có tên khớp với target
                for (int i = 0; i < num_waypoints; i++) {
                    if (waypoints[i].valid && strcmp(waypoints[i].name, target) == 0) {
                        *target_x = waypoints[i].x;
                        *target_y = waypoints[i].y;
                        *target_received = true;
                        *has_path = false;
                        *state = STATE_NAV_TO_TABLE;
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
// A* planning
bool plan_path(int sx, int sy, int gx, int gy) {
    // Tăng bán kính tìm kiếm lên kích thước map để đảm bảo tìm thấy ô trống
    int search_radius = MAP_SIZE_W; // 400
    if (!find_free(&sx, &sy, search_radius)) {
        printf("A* Error: Cannot find free cell near start!\n");
        return false;
    }
    if (!find_free(&gx, &gy, search_radius)) {
        printf("A* Error: Cannot find free cell near goal!\n");
        return false;
    }

    for (int y = 0; y < MAP_SIZE_H; y++) {
        for (int x = 0; x < MAP_SIZE_W; x++) {
            grid[y][x].g = INFINITY;
            grid[y][x].f = INFINITY;
            grid[y][x].closed = false;
            grid[y][x].px = 0;
            grid[y][x].py = 0;
        }
    }
    heap_size = 0;
    grid[sy][sx].g = 0;
    grid[sy][sx].f = heuristic(sx, sy, gx, gy);
    heap_push(sx, sy, grid[sy][sx].f);

    while (heap_size > 0) {
        HeapNode cur = heap_pop();
        int cx = cur.x, cy = cur.y;
        if (grid[cy][cx].closed) continue;
        grid[cy][cx].closed = true;

        if (cx == gx && cy == gy) {
            Node tmp[MAX_PATH_STEPS];
            int len = 0, tx = gx, ty = gy;
            while (tx != sx || ty != sy) {
                tmp[len].x = tx; tmp[len].y = ty; len++;
                if (len >= MAX_PATH_STEPS) break;
                int px = grid[ty][tx].px;
                int py = grid[ty][tx].py;
                tx = px; ty = py;
            }
            path_len = 0;
            for (int i = len - 1; i >= 0; i--) {
                global_path[path_len++] = tmp[i];
            }
            if (path_len == 0) return false;
            path_idx = 0;
            return true;
        }

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                int nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= MAP_SIZE_W || ny < 0 || ny >= MAP_SIZE_H) continue;
                if (!is_free(nx, ny) || grid[ny][nx].closed) continue;

                double cost = hypot(dx, dy);
                double newg = grid[cy][cx].g + cost;
                if (newg < grid[ny][nx].g) {
                    grid[ny][nx].px = cx;
                    grid[ny][nx].py = cy;
                    grid[ny][nx].g = newg;
                    grid[ny][nx].f = newg + heuristic(nx, ny, gx, gy);
                    heap_push(nx, ny, grid[ny][nx].f);
                }
            }
        }
    }
    return false;
}

// ------------------------------------------------------------
// DWA evaluation
double evaluate_trajectory(double v, double omega, double robot_x, double robot_y, double robot_theta,
                           double goal_x, double goal_y, double *lidar_ranges) {
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

    double clearance = LIDAR_MAX_RANGE;
    double step_dist = 0.05;
    double path_length = v * PREDICT_TIME;
    int num_steps = (int)(path_length / step_dist) + 1;
    for (int s = 0; s <= num_steps; s++) {
        double t = (double)s / num_steps * PREDICT_TIME;
        double cx = robot_x + v * cos(robot_theta + omega * t / 2.0) * t;
        double cy = robot_y + v * sin(robot_theta + omega * t / 2.0) * t;
        int mx, my;
        world_to_map(cx, cy, &mx, &my);

        double min_d = 1e6;
        for (int dx = -2; dx <= 2; dx++) {
            for (int dy = -2; dy <= 2; dy++) {
                int nx = mx + dx, ny = my + dy;
                if (nx >= 0 && nx < MAP_SIZE_W && ny >= 0 && ny < MAP_SIZE_H && !is_free(nx, ny)) {
                    double d = hypot(dx * MAP_RESOLUTION, dy * MAP_RESOLUTION);
                    if (d < min_d) min_d = d;
                }
            }
        }
        if (min_d < clearance) clearance = min_d;
    }
    if (clearance < 0.05) return 1e6;

    double dx_goal = goal_x - x;
    double dy_goal = goal_y - y;
    double goal_dir = atan2(dy_goal, dx_goal);
    double heading_err = fabs(goal_dir - th);
    while (heading_err > M_PI) heading_err -= 2.0 * M_PI;
    heading_err = fabs(heading_err);

    double heading_cost = heading_err / M_PI;
    double vel_cost = 1.0 - (v / MAX_SPEED);
    double clearance_cost = 1.0 - (clearance / LIDAR_MAX_RANGE);

    return HEADING_GAIN * heading_cost + CLEARANCE_GAIN * clearance_cost + VEL_GAIN * vel_cost;
}

void dwa_control(double robot_x, double robot_y, double robot_theta,
                 double goal_x, double goal_y, double *lidar_ranges,
                 double *out_v, double *out_omega) {
    double min_v = fmax(0.1, current_v - MAX_ACCEL * TIME_STEP / 1000.0);
    double max_v = fmin(MAX_SPEED, current_v + MAX_ACCEL * TIME_STEP / 1000.0);
    double min_omega = fmax(-MAX_OMEGA, current_omega - MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);
    double max_omega = fmin(MAX_OMEGA, current_omega + MAX_OMEGA_ACCEL * TIME_STEP / 1000.0);

    double best_cost = INFINITY;
    double best_v = 0.0, best_omega = 0.0;

    for (int i = 0; i <= V_SAMPLES; i++) {
        double v = min_v + (max_v - min_v) * i / V_SAMPLES;
        for (int j = 0; j <= OMEGA_SAMPLES; j++) {
            double omega = min_omega + (max_omega - min_omega) * j / OMEGA_SAMPLES;
            double cost = evaluate_trajectory(v, omega, robot_x, robot_y, robot_theta,
                                               goal_x, goal_y, lidar_ranges);
            if (cost >= 0 && cost < best_cost) {
                best_cost = cost;
                best_v = v;
                best_omega = omega;
            }
        }
    }

    if (best_cost == INFINITY || best_cost > 1000) {
        best_v = 0.2;
        double dx = goal_x - robot_x;
        double dy = goal_y - robot_y;
        double target_th = atan2(dy, dx);
        double err = target_th - robot_theta;
        while (err > M_PI) err -= 2 * M_PI;
        while (err < -M_PI) err += 2 * M_PI;
        best_omega = (err > 0) ? 0.5 : -0.5;
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

        // Lidar
        if (lidar != 0) {
            const float *ranges = wb_lidar_get_range_image(lidar);
            if (ranges) {
                int n = wb_lidar_get_number_of_points(lidar);
                int samples = n < LIDAR_NUM_SAMPLES ? n : LIDAR_NUM_SAMPLES;
                for (int i = 0; i < samples; i++) {
                    lidar_ranges[i] = ranges[i];
                    if (lidar_ranges[i] < 0.05) lidar_ranges[i] = 0.05;
                }
                for (int i = samples; i < LIDAR_NUM_SAMPLES; i++) lidar_ranges[i] = LIDAR_MAX_RANGE;
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
            // --- Kiểm tra: robot đã ở gần đích chưa? ---
            double dist_to_goal = hypot(target_x - robot_x, target_y - robot_y);
            if (dist_to_goal < WAYPOINT_ACCEPT_DIST) {
                // Đã ở tại đích, không cần A*
                target_received = false;
                has_path = false;
                robot_state = STATE_IDLE;
                printf("\n========== ARRIVED (already at goal) ==========\n");
                current_v = 0.0; current_omega = 0.0;
                wb_motor_set_velocity(left_motor, 0.0);
                wb_motor_set_velocity(right_motor, 0.0);
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
                write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                continue;
            }

            if (plan_path(sx, sy, gx, gy)) {
                printf("Path found, %d waypoints.\n", path_len);
                has_path = true;
            } else {
                // A* thực sự thất bại — không có đường đi hợp lệ
                target_received = false;
                printf("No path! Cannot reach target (%.2f, %.2f).\n", target_x, target_y);
            }
        }

        // ============================================================
        // Xác định local_goal và cập nhật waypoint
        double local_goal_x = target_x, local_goal_y = target_y;
        if (has_path && path_idx < path_len) {
            int wx = global_path[path_idx].x;
            int wy = global_path[path_idx].y;
            double current_wp_x, current_wp_y;
            map_to_world(wx, wy, &current_wp_x, &current_wp_y);
            double dist_to_current = hypot(current_wp_x - robot_x, current_wp_y - robot_y);

            if (dist_to_current < WAYPOINT_ACCEPT_DIST) {
                if (path_idx < path_len - 1) {
                    path_idx++;
                    continue;
                } else {
                    has_path = false;
                    target_received = false;
                    robot_state = STATE_IDLE;
                    printf("\n========== ARRIVED ==========\n");
                    current_v = 0;
                    current_omega = 0;
                    wb_motor_set_velocity(left_motor, 0);
                    wb_motor_set_velocity(right_motor, 0);
                    write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                    continue;
                }
            }

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
            } else {
                if (dist_to_current < WAYPOINT_ACCEPT_DIST * 1.5) {
                    should_advance = true;
                }
            }

            if (should_advance) {
                if (path_idx < path_len - 1) {
                    path_idx++;
                    continue;
                } else {
                    has_path = false;
                    target_received = false;
                    robot_state = STATE_IDLE;
                    printf("\n========== ARRIVED ==========\n");
                    current_v = 0;
                    current_omega = 0;
                    wb_motor_set_velocity(left_motor, 0);
                    wb_motor_set_velocity(right_motor, 0);
                    write_robot_state(robot_x, robot_y, robot_theta, 0.0, 0.0, get_state_string(robot_state));
                    continue;
                }
            }

            int look_ahead_idx = path_idx + 4;
            if (look_ahead_idx >= path_len) look_ahead_idx = path_len - 1;
            int nwx = global_path[look_ahead_idx].x;
            int nwy = global_path[look_ahead_idx].y;
            map_to_world(nwx, nwy, &local_goal_x, &local_goal_y);

        } else if (!has_path && target_received) {
            // Direct mode: vẫn dùng target làm điểm đến
            local_goal_x = target_x;
            local_goal_y = target_y;
        } else {
            // Idle
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
                    lidar_ranges, &cmd_v, &cmd_omega);
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
            printf("Pos: (%.2f,%.2f) th=%.2f v=%.2f w=%.2f goal=(%.2f,%.2f)\n",
                   robot_x, robot_y, robot_theta, current_v, current_omega, local_goal_x, local_goal_y);
        }
    }
    wb_robot_cleanup();
    return 0;
}