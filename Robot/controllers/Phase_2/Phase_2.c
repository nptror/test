//phase 
#include <webots/robot.h>
#include <webots/motor.h> 
#include <webots/position_sensor.h>
#include <webots/lidar.h>        
#include <webots/keyboard.h>     
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#define TIME_STEP 642
#define MAX_SPEED 10.0
#define MAX_ACCELERATION 0.15 

// --- CẤU HÌNH ĐỘNG HỌC ROBOT PIONEER ---
#define WHEEL_RADIUS 0.0975       
#define WHEEL_BASE 0.381          

// --- CẤU HÌNH MA TRẬN BẢN ĐỒ LƯỚI ---
#define MAP_SIZE 400            // Bản đồ vuông kích thước 400x400 ô
#define MAP_RESOLUTION 0.05     // Kích thước mỗi ô = 0.05 mét (5cm)
#define MAP_CENTER (MAP_SIZE/2) // Điểm xuất phát ban đầu (0,0) nằm ở tâm ma trận

// Các giá trị định nghĩa trạng thái của ô bản đồ
#define UNKNOWN 127             // Màu xám: Vùng chưa khám phá
#define FREE 255                // Màu trắng: Đường đi trống
#define OBSTACLE 0              // Màu đen: Vật cản/Tường

// Khai báo ma trận lưu trữ bản đồ nhà hàng toàn cục
unsigned char restaurant_map[MAP_SIZE][MAP_SIZE];

// Hàm khởi tạo bản đồ ban đầu toàn màu xám
void init_map() {
  for (int i = 0; i < MAP_SIZE; i++) {
    for (int j = 0; j < MAP_SIZE; j++) {
      restaurant_map[i][j] = UNKNOWN;
    }
  }
}

// Hàm xuất ma trận bản đồ thành file ảnh .pgm lưu vào ổ cứng
void save_map_to_disk(const char *filename) {
  FILE *fp = fopen(filename, "wb");
  if (fp == NULL) {
    printf("[LỖI] Không thể tạo file lưu bản đồ!\n");
    return;
  }
  // Ghi phần header chuẩn của định dạng ảnh PGM (Portable Graymap)
  fprintf(fp, "P5\n%d %d\n255\n", MAP_SIZE, MAP_SIZE);
  // Ghi toàn bộ khối ma trận dữ liệu ảnh
  fwrite(restaurant_map, sizeof(unsigned char), MAP_SIZE * MAP_SIZE, fp);
  fclose(fp);
  printf("\n=======================================================\n");
  printf("[THÀNH CÔNG] Đã lưu bản đồ thành file: %s\n", filename);
  printf("=======================================================\n");
}

int main(int argc, char **argv) {
  wb_robot_init();
  init_map(); // Khởi tạo bộ nhớ trống cho bản đồ

  // 1. KHỞI TẠO PHẦN CỨNG
  WbDeviceTag left_motor = wb_robot_get_device("left wheel");
  WbDeviceTag right_motor = wb_robot_get_device("right wheel");
  WbDeviceTag left_encoder = wb_robot_get_device("left wheel sensor");
  WbDeviceTag right_encoder = wb_robot_get_device("right wheel sensor");

  wb_motor_set_position(left_motor, INFINITY);
  wb_motor_set_position(right_motor, INFINITY);
  wb_motor_set_velocity(left_motor, 0.0);
  wb_motor_set_velocity(right_motor, 0.0);

  wb_position_sensor_enable(left_encoder, TIME_STEP);
  wb_position_sensor_enable(right_encoder, TIME_STEP);

  WbDeviceTag lidar = wb_robot_get_device("Sick LMS 291");
  wb_lidar_enable(lidar, TIME_STEP);
  int lidar_width = wb_lidar_get_horizontal_resolution(lidar);
  double lidar_fov = wb_lidar_get_fov(lidar); // Góc quét của Lidar

  wb_keyboard_enable(TIME_STEP);

  // Biến phục vụ Bộ đo quãng đường (Odometry)
  double robot_x = 0.0, robot_y = 0.0, robot_theta = 0.0;
  double last_left_pos = 0.0, last_right_pos = 0.0;
  double current_v_left = 0.0, current_v_right = 0.0;

  printf("=======================================================\n");
  printf("  HỆ THỐNG MAP-BUILDING & ĐÁNH DẤU BÀN ĂN SẴN SÀNG      \n");
  printf("  - Lái xe bằng các phím mũi tên để quét hết nhà hàng.  \n");
  printf("  - Bấm phím [1] : Lưu vị trí BÀN 1                     \n");
  printf("  - Bấm phím [2] : Lưu vị trí BÀN 2                     \n");
  printf("  - Bấm phím [B] : Lưu vị trí QUẦY BẾP                  \n");
  printf("  - Bấm phím [S] : LƯU FILE BẢN ĐỒ 'map_nhahang.pgm'    \n");
  printf("=======================================================\n");

  /* VÒNG LẶP CHÍNH */
  while (wb_robot_step(TIME_STEP) != -1) {
    
    // --- CẬP NHẬT ĐỘNG HỌC ODOMETRY ---
    double left_pos = wb_position_sensor_get_value(left_encoder);
    double right_pos = wb_position_sensor_get_value(right_encoder);
    double d_left = left_pos - last_left_pos;
    double d_right = right_pos - last_right_pos;
    last_left_pos = left_pos; last_right_pos = right_pos;

    double distance_left = d_left * WHEEL_RADIUS;
    double distance_right = d_right * WHEEL_RADIUS;
    double d_center = (distance_left + distance_right) / 2.0;
    double d_theta = (distance_right - distance_left) / WHEEL_BASE;

    robot_x += d_center * cos(robot_theta + d_theta / 2.0);
    robot_y += d_center * sin(robot_theta + d_theta / 2.0);
    robot_theta += d_theta;

    if (robot_theta > M_PI) robot_theta -= 2.0 * M_PI;
    if (robot_theta < -M_PI) robot_theta += 2.0 * M_PI;

    // --- CẬP NHẬT MAP BẰNG THUẬT TOÁN CHIẾU TIA LIDAR ---
    const float *range_image = wb_lidar_get_range_image(lidar);
    
    if (range_image != NULL) {
      // Đánh dấu vị trí hiện tại của Robot là vùng trống (FREE)
      int r_map_x = MAP_CENTER + (int)(robot_x / MAP_RESOLUTION);
      int r_map_y = MAP_CENTER - (int)(robot_y / MAP_RESOLUTION);
      if (r_map_x >= 0 && r_map_x < MAP_SIZE && r_map_y >= 0 && r_map_y < MAP_SIZE) {
        restaurant_map[r_map_y][r_map_x] = FREE;
      }

      // Quét qua từng tia trong số các tia Lidar bắn ra
      for (int i = 0; i < lidar_width; i++) {
        float distance = range_image[i];
        
        // Bỏ qua nếu khoảng cách vượt giới hạn hoặc lỗi
        if (distance <= 0.0 || distance >= wb_lidar_get_max_range(lidar) || isnan(distance)) continue;

        // Tính toán góc cục bộ của tia thứ i
        double angle = robot_theta - (lidar_fov / 2.0) + (i * (lidar_fov / (lidar_width - 1)));

        // Quy đổi sang Tọa độ tuyệt đối (mét)
        double obstacle_x = robot_x + distance * cos(angle);
        double obstacle_y = robot_y + distance * sin(angle);

        // Chuyển đổi sang tọa độ pixel trên ma trận
        int map_x = MAP_CENTER + (int)(obstacle_x / MAP_RESOLUTION);
        int map_y = MAP_CENTER - (int)(obstacle_y / MAP_RESOLUTION);

        if (map_x >= 0 && map_x < MAP_SIZE && map_y >= 0 && map_y < MAP_SIZE) {
          // Đánh dấu ô chứa VẬT CẢN (Màu đen)
          restaurant_map[map_y][map_x] = OBSTACLE;

          // Thuật toán vẽ đường trống giữa Robot và Vật cản
          for (double step = 0.1; step < distance; step += MAP_RESOLUTION) {
            int free_x = MAP_CENTER + (int)((robot_x + step * cos(angle)) / MAP_RESOLUTION);
            int free_y = MAP_CENTER - (int)((robot_y + step * sin(angle)) / MAP_RESOLUTION);
            if (free_x >= 0 && free_x < MAP_SIZE && free_y >= 0 && free_y < MAP_SIZE) {
              if (restaurant_map[free_y][free_x] != OBSTACLE) {
                restaurant_map[free_y][free_x] = FREE;
              }
            }
          }
        }
      }
    }

    // --- HỆ THỐNG ĐIỀU KHIỂN & XỬ LÝ NÚT BẤM LƯU ---
    double target_v_left = 0.0, target_v_right = 0.0;
    int key = wb_keyboard_get_key();

    if (key == WB_KEYBOARD_UP) { 
      target_v_left = MAX_SPEED * 0.4; target_v_right = MAX_SPEED * 0.4;
    } else if (key == WB_KEYBOARD_DOWN) { 
      target_v_left = -MAX_SPEED * 0.4; target_v_right = -MAX_SPEED * 0.4;
    } else if (key == WB_KEYBOARD_LEFT) { 
      target_v_left = -MAX_SPEED * 0.25; target_v_right = MAX_SPEED * 0.25;
    } else if (key == WB_KEYBOARD_RIGHT) { 
      target_v_left = MAX_SPEED * 0.25; target_v_right = -MAX_SPEED * 0.25;
    } else if (key == 'S' || key == 's') { 
      save_map_to_disk("map_nhahang.pgm");
    } 
    // --- LƯU TỌA ĐỘ VỊ TRÍ ĐÍCH THEO PHÍM BẤM ---
   // Lưu vị trí các bàn từ phím 1 -> 9
else if (key >= '1' && key <= '9') {

  int table_number = key - '0';

  FILE *f_table = fopen("waypoints.txt", "a");

  if (f_table != NULL) {

    fprintf(
      f_table,
      "Ban_%d: X = %.2f, Y = %.2f, Theta = %.2f\n",
      table_number,
      robot_x,
      robot_y,
      robot_theta
    );

    fclose(f_table);

    printf("\n");
    printf("========================================\n");
    printf("[DA LUU] BAN %d\n", table_number);
    printf("X = %.2f m\n", robot_x);
    printf("Y = %.2f m\n", robot_y);
    printf("Theta = %.2f rad\n", robot_theta);
    printf("========================================\n");
  }
}
    else if (key == 'B' || key == 'b') { 
      FILE *f_table = fopen("waypoints.txt", "a");
      if (f_table != NULL) {
        fprintf(f_table, "Quay_Bep: X = %.2f, Y = %.2f, Theta = %.2f\n", robot_x, robot_y, robot_theta);
        fclose(f_table);
        printf("[ĐÃ LƯU] Đặt vị trí QUẦY BẾP tại: X = %.2fm, Y = %.2fm\n", robot_x, robot_y);
      }
    }
    else { 
      target_v_left = 0.0; target_v_right = 0.0;
    }

    // BỘ LỌC GIA TỐC CHỐNG LẬT XE WHEN RUNNING/STOPPING
    double diff_left = target_v_left - current_v_left;
    current_v_left += (fabs(diff_left) > MAX_ACCELERATION) ? ((diff_left > 0) ? MAX_ACCELERATION : -MAX_ACCELERATION) : diff_left;
    double diff_right = target_v_right - current_v_right;
    current_v_right += (fabs(diff_right) > MAX_ACCELERATION) ? ((diff_right > 0) ? MAX_ACCELERATION : -MAX_ACCELERATION) : diff_right;

    wb_motor_set_velocity(left_motor, current_v_left);
    wb_motor_set_velocity(right_motor, current_v_right);
  }

  wb_robot_cleanup();
  return 0;
}