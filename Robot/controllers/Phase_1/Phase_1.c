#include <webots/robot.h>
#include <webots/motor.h> 
#include <webots/position_sensor.h>
#include <webots/led.h>
#include <stdio.h>
#include <math.h>

#define TIME_STEP 64

// Thông số vật lý chuẩn của robot Pioneer 3-DX
#define WHEEL_RADIUS 0.0975  // Bán kính bánh xe (r) tính bằng mét
#define AXLE_LENGTH 0.381    // Khoảng cách giữa 2 bánh xe (L) tính bằng mét

// Khai báo các thẻ thiết bị toàn cục
WbDeviceTag left_motor, right_motor;
WbDeviceTag left_encoder, right_encoder;
WbDeviceTag green_led, white_led, red_led_1, red_led_2, red_led_3;

// Các biến phục vụ tính toán Odometry
double prev_left_pos = 0.0;
double prev_right_pos = 0.0;
double total_distance = 0.0; // Tổng quãng đường robot đã đi (mét)

/* HÀM 1: KHỞI TẠO VÀ CẤU HÌNH CÁC THIẾT BỊ */
void init_devices() {
  // Lấy thẻ thiết bị dựa trên danh sách quét chính xác của bạn
  left_motor = wb_robot_get_device("left wheel");
  right_motor = wb_robot_get_device("right wheel");
  left_encoder = wb_robot_get_device("left wheel sensor");
  right_encoder = wb_robot_get_device("right wheel sensor");
  
  green_led = wb_robot_get_device("green led");
  white_led = wb_robot_get_device("white led");
  red_led_1 = wb_robot_get_device("red led 1");
  red_led_2 = wb_robot_get_device("red led 2");
  red_led_3 = wb_robot_get_device("red led 3");

  // NHIỆM VỤ 1: Chuyển motor sang chế độ điều khiển vận tốc (Velocity Control)
  wb_motor_set_position(left_motor, INFINITY);
  wb_motor_set_position(right_motor, INFINITY);
  wb_motor_set_velocity(left_motor, 0.0);
  wb_motor_set_velocity(right_motor, 0.0);

  // NHIỆM VỤ 2: Kích hoạt cảm biến Encoder (Position Sensor)
  wb_position_sensor_enable(left_encoder, TIME_STEP);
  wb_position_sensor_enable(right_encoder, TIME_STEP);
}

/* HÀM 2: ĐỘNG HỌC VI SAI - QUY ĐỔI VẬN TỐC ROBOT SANG VẬN TỐC BÁNH XE */
void set_robot_velocity(double linear_vel, double angular_vel) {
  // Công thức động học vi sai ngược
  double left_vel = (linear_vel - angular_vel * (AXLE_LENGTH / 2.0)) / WHEEL_RADIUS;
  double right_vel = (linear_vel + angular_vel * (AXLE_LENGTH / 2.0)) / WHEEL_RADIUS;

  // Giới hạn tốc độ tối đa của mô-tơ Pioneer (khoảng 12.3 rad/s)
  if (left_vel > 12.0) left_vel = 12.0;
  if (left_vel < -12.0) left_vel = -12.0;
  if (right_vel > 12.0) right_vel = 12.0;
  if (right_vel < -12.0) right_vel = -12.0;

  wb_motor_set_velocity(left_motor, left_vel);
  wb_motor_set_velocity(right_motor, right_vel);
}

/* HÀM 3: TÍNH TOÁN ODOMETRY TỪ PHẢN HỒI ENCODER */
void update_odometry() {
  double curr_left_pos = wb_position_sensor_get_value(left_encoder);
  double curr_right_pos = wb_position_sensor_get_value(right_encoder);

  // Tránh lỗi đọc giá trị NaN ở chu kỳ đầu tiên khi cảm biến chưa kịp phản hồi
  if (isnan(curr_left_pos) || isnan(curr_right_pos)) return;

  // Tính quãng đường đi được của từng bánh kể từ chu kỳ trước
  double d_left = (curr_left_pos - prev_left_pos) * WHEEL_RADIUS;
  double d_right = (curr_right_pos - prev_right_pos) * WHEEL_RADIUS;

  // Quãng đường tịnh tiến trung bình của tâm robot
  double d_center = (d_left + d_right) / 2.0;
  total_distance += d_center;

  // Cập nhật lại biến lưu trạng thái trước
  prev_left_pos = curr_left_pos;
  prev_right_pos = curr_right_pos;
}

/* HÀM 4: ĐIỀU KHIỂN HỆ THỐNG ĐÈN TRẠNG THÁI (LED) */
void update_lights_system(double linear_vel, double angular_vel) {
  // Nếu robot đang chạy (tiến hoặc lùi hoặc xoay)
  if (fabs(linear_vel) > 0.01 || fabs(angular_vel) > 0.01) {
    wb_led_set(green_led, 1); // Bật đèn xanh lá
    wb_led_set(white_led, 1); // Bật đèn trắng
  } else {
    wb_led_set(green_led, 0);
    wb_led_set(white_led, 0);
  }

  // NHIỆM VỤ 3: Nhấp nháy cụm đèn đỏ 1, 2, 3 khi rẽ hoặc lùi
  // Sử dụng hàm lấy thời gian của mô phỏng để tạo nhịp nháy (chu kỳ 500ms)
  int blink = ((int)(wb_robot_get_time() * 2)) % 2;

  if (linear_vel < -0.01 || fabs(angular_vel) > 0.1) {
    // Nếu lùi hoặc rẽ góc lớn -> bật nhấp nháy đèn đỏ cảnh báo
    wb_led_set(red_led_1, blink);
    wb_led_set(red_led_2, blink);
    wb_led_set(red_led_3, blink);
  } else {
    // Trạng thái chạy tiến bình thường -> Tắt đèn đỏ
    wb_led_set(red_led_1, 0);
    wb_led_set(red_led_2, 0);
    wb_led_set(red_led_3, 0);
  }
}

/* KHUNG CHƯƠNG TRÌNH CHÍNH KỊCH BẢN CHẠY DEMO */
int main(int argc, char **argv) {
  wb_robot_init();
  init_devices();

  // Biến cấu hình vận tốc mục tiêu muốn điều khiển
  double target_linear_velocity = 0.2;  // Xe tiến 0.2 m/s
  double target_angular_velocity = 0.0; // Không xoay góc

  printf("Hệ thống Động học & Odometry khởi động hoàn tất!\n");

  /* VÒNG LẶP ĐIỀU KHIỂN REAL-TIME */
  while (wb_robot_step(TIME_STEP) != -1) {
    double current_time = wb_robot_get_time();

    // KỊCH BẢN TEST CÁC TRẠNG THÁI ĐỂ KIỂM TRA ĐÈN VÀ ĐỘNG HỌC:
    if (current_time < 2.0) {
      // 5 giây đầu: Chạy Tiến bình thường
      target_linear_velocity = 0.2;
      target_angular_velocity = 0.0;
    } 
    else if (current_time >= 5.0 && current_time < 9.0) {
      // Từ giây thứ 5 đến 9: Xe thực hiện lệnh RẼ PHẢI (bật nhấp nháy LED đỏ)
      target_linear_velocity = 0.1;
      target_angular_velocity = -0.5; 
    } 
    else if (current_time >= 9.0 && current_time < 13.0) {
      // Từ giây thứ 9 đến 13: Xe thực hiện lệnh CHẠY LÙI (bật nhấp nháy LED đỏ)
      target_linear_velocity = -0.15;
      target_angular_velocity = 0.0;
    } 
    else {
      // Sau đó: Dừng hẳn xe
      target_linear_velocity = 0.0;
      target_angular_velocity = 0.0;
    }

    // Thực thi hệ thống hàm xử lý
    set_robot_velocity(target_linear_velocity, target_angular_velocity);
    update_odometry();
    update_lights_system(target_linear_velocity, target_angular_velocity);

    // In thông số kiểm định chất lượng lên Console mỗi giây
    if (((int)(current_time * 10)) % 10 == 0) {
      printf("[TIME: %.1fs] V_đặt = %.2f m/s | W_đặt = %.2f rad/s | Tổng quãng đường Odometry = %.3f mét\n", 
             current_time, target_linear_velocity, target_angular_velocity, total_distance);
    }
  }

  wb_robot_cleanup();
  return 0;
}