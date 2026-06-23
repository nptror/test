#include <webots/robot.h>
#include <webots/motor.h> 
#include <webots/device.h> // BẮT BUỘC phải có thư viện này để dùng hàm wb_device_...
#include <stdio.h>
#include <string.h>

#define TIME_STEP 64
#define TARGET_RADIAN 10.256

int main(int argc, char **argv) {
  wb_robot_init();

  WbDeviceTag left_motor = 0;
  WbDeviceTag right_motor = 0;

  // 1. TỰ ĐỘNG DÒ TÌM TÊN MOTOR TRÊN ROBOT
  int n_devices = wb_robot_get_number_of_devices();
  printf("--- ĐANG QUÉT DANH SÁCH THIẾT BỊ TRÊN ROBOT (%d thiết bị) ---\n", n_devices);
  
  for (int i = 0; i < n_devices; i++) {
    WbDeviceTag tag = wb_robot_get_device_by_index(i);
    const char *name = wb_device_get_name(tag);             // Hàm chuẩn Webots
    WbNodeType type = wb_device_get_node_type(tag);         // Hàm chuẩn Webots

    // In ra màn hình console để bạn nhìn thấy tên linh kiện thực tế
    printf("Thiết bị index [%d]: Tên = \"%s\"\n", i, name);

    // Nếu thiết bị là Động cơ cơ học (RotationalMotor)
    if (type == WB_NODE_ROTATIONAL_MOTOR) {
      // Dò từ khóa dựa trên tên tiếng Anh phổ biến
      if (strstr(name, "left") || strstr(name, "l_") || strstr(name, "Left")) {
        left_motor = tag;
        printf("  => Đã nhận diện tự động làm MOTOR TRÁI!\n");
      } else if (strstr(name, "right") || strstr(name, "r_") || strstr(name, "Right")) {
        right_motor = tag;
        printf("  => Đã nhận diện tự động làm MOTOR PHẢI!\n");
      }
    }
  }
  printf("-------------------------------------------------------\n");

  // Nếu hệ thống tự quét từ khóa thất bại, ép lấy đại 2 motor đầu tiên tìm thấy
  if (left_motor == 0 || right_motor == 0) {
    printf("[CẢNH BÁO] Không phân biệt được trái/phải qua tên. Chọn 2 motor ngẫu nhiên.\n");
    for (int i = 0; i < n_devices; i++) {
      WbDeviceTag tag = wb_robot_get_device_by_index(i);
      if (wb_device_get_node_type(tag) == WB_NODE_ROTATIONAL_MOTOR) {
        if (left_motor == 0) left_motor = tag;
        else if (right_motor == 0) { right_motor = tag; break; }
      }
    }
  }

  // Nếu robot thực sự không được gắn motor bánh xe nào
  if (left_motor == 0 || right_motor == 0) {
    printf("[LỖI] Robot này hoàn toàn không có khớp motor bánh xe nào để chạy!\n");
    while (wb_robot_step(TIME_STEP) != -1);
    wb_robot_cleanup();
    return 0;
  }

  /* 2. ĐIỀU KHIỂN CHẠY TIẾN 1M */
  wb_motor_set_velocity(left_motor, 2.0);
  wb_motor_set_velocity(right_motor, 2.0);

  int state = 0;
  wb_motor_set_position(left_motor, TARGET_RADIAN);
  wb_motor_set_position(right_motor, TARGET_RADIAN);
  printf("Trạng thái 0: Xuất phát! Robot tiến lên 1 mét...\n");

  /* VÒNG LẶP CHÍNH */
  while (wb_robot_step(TIME_STEP) != -1) {
    double time = wb_robot_get_time();

    if (state == 0) {
      if (time > 5.5) {
        state = 1;
        // Ra lệnh lùi về vạch số 0
        wb_motor_set_position(left_motor, 0.0);
        wb_motor_set_position(right_motor, 0.0);
        printf("Trạng thái 1: Đã tiến xong 1m. Bắt đầu lùi 1 mét...\n");
      }
    } 
    else if (state == 1) {
      if (time > 11.0) {
        state = 2;
        printf("Trạng thái 2: HOÀN THÀNH bài test thành công!\n");
      }
    } 
    else if (state == 2) {
      wb_motor_set_velocity(left_motor, 0.0);
      wb_motor_set_velocity(right_motor, 0.0);
    }
  }

  wb_robot_cleanup();
  return 0;
}