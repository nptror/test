//phase 2 
#include <webots/robot.h>
#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <webots/lidar.h>
#include <webots/keyboard.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#define TIME_STEP 64
#define MAX_SPEED 15.0
#define MAX_ACCELERATION 0.15

// --- CẤU HÌNH ĐỘNG HỌC ROBOT PIONEER 3AT ---
#define WHEEL_RADIUS 0.0975
#define WHEEL_BASE   0.381      // Khoảng cách giữa bánh trái và phải (tính từ tâm)

// --- CẤU HÌNH BẢN ĐỒ LƯỚI ---
#define MAP_SIZE 400
#define MAP_RESOLUTION 0.05
#define MAP_CENTER (MAP_SIZE/2)

#define UNKNOWN 127
#define FREE    255
#define OBSTACLE 0

// Ma trận bản đồ toàn cục
unsigned char restaurant_map[MAP_SIZE][MAP_SIZE];

void init_map() {
    for (int i = 0; i < MAP_SIZE; i++) {
        for (int j = 0; j < MAP_SIZE; j++) {
            restaurant_map[i][j] = UNKNOWN;
        }
    }
}

void save_map_to_disk(const char *filename) {
    FILE *fp = fopen(filename, "wb");
    if (fp == NULL) {
        printf("[LỖI] Không thể tạo file bản đồ!\n");
        return;
    }
    fprintf(fp, "P5\n%d %d\n255\n", MAP_SIZE, MAP_SIZE);
    fwrite(restaurant_map, sizeof(unsigned char), MAP_SIZE * MAP_SIZE, fp);
    fclose(fp);
    printf("\n=======================================================\n");
    printf("[THÀNH CÔNG] Đã lưu bản đồ vào file: %s\n", filename);
    printf("=======================================================\n");
}

int main(int argc, char **argv) {
    wb_robot_init();
    init_map();

    // --- LẤY CÁC THIẾT BỊ CỦA PIONEER 3AT ---
    // 4 động cơ bánh xe
    WbDeviceTag fl_motor = wb_robot_get_device("front left wheel");
    WbDeviceTag fr_motor = wb_robot_get_device("front right wheel");
    WbDeviceTag bl_motor = wb_robot_get_device("back left wheel");
    WbDeviceTag br_motor = wb_robot_get_device("back right wheel");

    // 4 encoder (chỉ cần dùng 2 bánh trước cho odometry)
    WbDeviceTag fl_encoder = wb_robot_get_device("front left wheel sensor");
    WbDeviceTag fr_encoder = wb_robot_get_device("front right wheel sensor");

    // Cấu hình chế độ vận tốc cho tất cả động cơ
    wb_motor_set_position(fl_motor, INFINITY);
    wb_motor_set_position(fr_motor, INFINITY);
    wb_motor_set_position(bl_motor, INFINITY);
    wb_motor_set_position(br_motor, INFINITY);

    wb_motor_set_velocity(fl_motor, 0.0);
    wb_motor_set_velocity(fr_motor, 0.0);
    wb_motor_set_velocity(bl_motor, 0.0);
    wb_motor_set_velocity(br_motor, 0.0);

    // Bật encoder
    wb_position_sensor_enable(fl_encoder, TIME_STEP);
    wb_position_sensor_enable(fr_encoder, TIME_STEP);

    // Lidar
    WbDeviceTag lidar = wb_robot_get_device("Sick LMS 291");
    wb_lidar_enable(lidar, TIME_STEP);
    int lidar_width = wb_lidar_get_horizontal_resolution(lidar);
    double lidar_fov = wb_lidar_get_fov(lidar);

    // Bàn phím
    wb_keyboard_enable(TIME_STEP);

    // Odometry
    double robot_x = 0.0, robot_y = 0.0, robot_theta = 0.0;
    double last_left_pos = 0.0, last_right_pos = 0.0;
    double current_v_left = 0.0, current_v_right = 0.0;

    printf("=========================================================\n");
    printf("  PIONEER 3AT - XÂY DỰNG BẢN ĐỒ & ĐÁNH DẤU 4 BÀN ĂN    \n");
    printf("  - Mũi tên: lái robot quét toàn bộ nhà hàng            \n");
    printf("  - Phím [1][2][3][4] : Lưu tọa độ bàn ăn số 1,2,3,4   \n");
    printf("  - Phím [B] : Lưu vị trí quầy bếp (tuỳ chọn)           \n");
    printf("  - Phím [S] : Lưu file bản đồ 'map_nhahang.pgm'        \n");
    printf("=========================================================\n");

    while (wb_robot_step(TIME_STEP) != -1) {
        // --- CẬP NHẬT ODOMETRY (dùng encoder bánh trước) ---
        double left_pos = wb_position_sensor_get_value(fl_encoder);
        double right_pos = wb_position_sensor_get_value(fr_encoder);
        double d_left = left_pos - last_left_pos;
        double d_right = right_pos - last_right_pos;
        last_left_pos = left_pos;
        last_right_pos = right_pos;

        double distance_left = d_left * WHEEL_RADIUS;
        double distance_right = d_right * WHEEL_RADIUS;
        double d_center = (distance_left + distance_right) / 2.0;
        double d_theta = (distance_right - distance_left) / WHEEL_BASE;

        robot_x += d_center * cos(robot_theta + d_theta/2.0);
        robot_y += d_center * sin(robot_theta + d_theta/2.0);
        robot_theta += d_theta;

        if (robot_theta > M_PI) robot_theta -= 2.0 * M_PI;
        if (robot_theta < -M_PI) robot_theta += 2.0 * M_PI;

        // --- XÂY DỰNG BẢN ĐỒ TỪ LIDAR ---
        const float *range_image = wb_lidar_get_range_image(lidar);
        if (range_image != NULL) {
            // Đánh dấu vị trí robot hiện tại là FREE
            int rx = MAP_CENTER + (int)(robot_x / MAP_RESOLUTION);
            int ry = MAP_CENTER - (int)(robot_y / MAP_RESOLUTION);
            if (rx >= 0 && rx < MAP_SIZE && ry >= 0 && ry < MAP_SIZE) {
                restaurant_map[ry][rx] = FREE;
            }

            for (int i = 0; i < lidar_width; i++) {
                float distance = range_image[i];
                if (distance <= 0.0 || distance >= wb_lidar_get_max_range(lidar) || isnan(distance))
                    continue;

                double angle = robot_theta - (lidar_fov/2.0) + i * (lidar_fov / (lidar_width-1));
                double ox = robot_x + distance * cos(angle);
                double oy = robot_y + distance * sin(angle);
                int mx = MAP_CENTER + (int)(ox / MAP_RESOLUTION);
                int my = MAP_CENTER - (int)(oy / MAP_RESOLUTION);
                if (mx >= 0 && mx < MAP_SIZE && my >= 0 && my < MAP_SIZE) {
                    restaurant_map[my][mx] = OBSTACLE;
                }

                // Vẽ vùng trống dọc theo tia
                for (double step = 0.1; step < distance; step += MAP_RESOLUTION) {
                    int fx = MAP_CENTER + (int)((robot_x + step * cos(angle)) / MAP_RESOLUTION);
                    int fy = MAP_CENTER - (int)((robot_y + step * sin(angle)) / MAP_RESOLUTION);
                    if (fx >= 0 && fx < MAP_SIZE && fy >= 0 && fy < MAP_SIZE) {
                        if (restaurant_map[fy][fx] != OBSTACLE)
                            restaurant_map[fy][fx] = FREE;
                    }
                }
            }
        }

        // --- ĐIỀU KHIỂN BÀN PHÍM ---
        double target_v_left = 0.0, target_v_right = 0.0;
        int key = wb_keyboard_get_key();

        switch(key) {
            case WB_KEYBOARD_UP:
                target_v_left = MAX_SPEED * 0.4;
                target_v_right = MAX_SPEED * 0.4;
                break;
            case WB_KEYBOARD_DOWN:
                target_v_left = -MAX_SPEED * 0.4;
                target_v_right = -MAX_SPEED * 0.4;
                break;
            case WB_KEYBOARD_LEFT:
                target_v_left = -MAX_SPEED * 0.25;
                target_v_right = MAX_SPEED * 0.25;
                break;
            case WB_KEYBOARD_RIGHT:
                target_v_left = MAX_SPEED * 0.25;
                target_v_right = -MAX_SPEED * 0.25;
                break;
            case 'S':
            case 's':
                save_map_to_disk("map_nhahang.pgm");
                break;
            case 'B':
            case 'b': {
                FILE *fp = fopen("waypoints.txt", "a");
                if (fp) {
                    fprintf(fp, "Quay_Bep: X=%.2f Y=%.2f Theta=%.2f\n", robot_x, robot_y, robot_theta);
                    fclose(fp);
                    printf("[ĐÃ LƯU] Quầy bếp: (%.2f, %.2f, %.2f rad)\n", robot_x, robot_y, robot_theta);
                }
                break;
            }
            default:
                // Lưu bàn ăn khi nhấn 1,2,3,4
                if (key >= '1' && key <= '4') {
                    int table_num = key - '0';
                    FILE *fp = fopen("waypoints.txt", "a");
                    if (fp) {
                        fprintf(fp, "Ban_%d: X=%.2f Y=%.2f Theta=%.2f\n", table_num, robot_x, robot_y, robot_theta);
                        fclose(fp);
                        printf("\n========================================\n");
                        printf("[ĐÃ LƯU] Bàn %d\n", table_num);
                        printf("  X = %.2f m\n", robot_x);
                        printf("  Y = %.2f m\n", robot_y);
                        printf("  Theta = %.2f rad\n", robot_theta);
                        printf("========================================\n");
                    }
                } else {
                    target_v_left = 0.0;
                    target_v_right = 0.0;
                }
                break;
        }

        // Giới hạn gia tốc
        double diff_left = target_v_left - current_v_left;
        if (fabs(diff_left) > MAX_ACCELERATION)
            current_v_left += (diff_left > 0) ? MAX_ACCELERATION : -MAX_ACCELERATION;
        else
            current_v_left = target_v_left;

        double diff_right = target_v_right - current_v_right;
        if (fabs(diff_right) > MAX_ACCELERATION)
            current_v_right += (diff_right > 0) ? MAX_ACCELERATION : -MAX_ACCELERATION;
        else
            current_v_right = target_v_right;

        // Đặt vận tốc cho cả 4 bánh (cùng bên chạy cùng vận tốc)
        wb_motor_set_velocity(fl_motor, current_v_left);
        wb_motor_set_velocity(bl_motor, current_v_left);
        wb_motor_set_velocity(fr_motor, current_v_right);
        wb_motor_set_velocity(br_motor, current_v_right);
    }

    wb_robot_cleanup();
    return 0;
}