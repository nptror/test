#include <webots/robot.h>
#include <webots/motor.h> 
#include <webots/distance_sensor.h>
#include <webots/camera.h>
#include <webots/lidar.h>
#include <webots/device.h>
#include <stdio.h>
#include <string.h>

#define TIME_STEP 64

int main(int argc, char **argv) {
  wb_robot_init();

  printf("=======================================================\n");
  printf("   BẮT ĐẦU KIỂM TRA TOÀN DIỆN THIẾT BỊ ROBOT PIONEER   \n");
  printf("=======================================================\n");

  // --- PHẦN 1: TỰ ĐỘNG DÒ TÌM VÀ ĐÁNH GIÁ MOTOR BÁNH XE ---
  WbDeviceTag left_motor = 0, right_motor = 0;
  int n_devices = wb_robot_get_number_of_devices();
  
  for (int i = 0; i < n_devices; i++) {
    WbDeviceTag tag = wb_robot_get_device_by_index(i);
    const char *name = wb_device_get_name(tag);
    WbNodeType type = wb_device_get_node_type(tag);

    if (type == WB_NODE_ROTATIONAL_MOTOR) {
      if (strstr(name, "left") || strstr(name, "l_") || strstr(name, "Left")) {
        left_motor = tag;
        printf("[OK] Tìm thấy Motor Trái: \"%s\"\n", name);
      } else if (strstr(name, "right") || strstr(name, "r_") || strstr(name, "Right")) {
        right_motor = tag;
        printf("[OK] Tìm thấy Motor Phải: \"%s\"\n", name);
      }
    }
  }

  // Khởi tạo vận tốc an toàn cho Motor nếu tìm thấy
  if (left_motor != 0 && right_motor != 0) {
    wb_motor_set_position(left_motor, INFINITY);
    wb_motor_set_position(right_motor, INFINITY);
    wb_motor_set_velocity(left_motor, 1.0); // Quay chậm để test bánh
    wb_motor_set_velocity(right_motor, -1.0); // Xoay ngược hướng để robot xoay tại chỗ
    printf("-> Đã kích hoạt Động cơ: Robot bắt đầu xoay tại chỗ.\n");
  } else {
    printf("[THẤT BẠI] Không xác định được Motor bánh xe. Vui lòng check lại cấu hình.\n");
  }

  // --- PHẦN 2: KÍCH HOẠT VÀ KIỂM TRA CÁC CẢM BIẾN (Dựa trên ảnh của bạn) ---
  
  // 1. Cảm biến siêu âm/khoảng cách "so"
  WbDeviceTag ds = wb_robot_get_device("so");
  if (ds != 0) {
    wb_distance_sensor_enable(ds, TIME_STEP);
    printf("[OK] Đã kích hoạt Cảm biến khoảng cách \"so\"\n");
  } else {
    printf("[ẢO] Không tìm thấy cảm biến tên \"so\"\n");
  }

  // 2. Camera chiều sâu Kinect
  WbDeviceTag kinect = wb_robot_get_device("Kinect");
  if (kinect != 0) {
    wb_camera_enable(kinect, TIME_STEP);
    printf("[OK] Đã kích hoạt Camera \"Kinect\" (Độ phân giải: %dx%d)\n", 
           wb_camera_get_width(kinect), wb_camera_get_height(kinect));
  } else {
    printf("[ẢO] Không tìm thấy thiết bị tên \"Kinect\"\n");
  }

  // 3. Cảm biến Lidar Sick LMS 291
  WbDeviceTag lidar = wb_robot_get_device("Sick LMS 291");
  if (lidar == 0) {
    lidar = wb_robot_get_device("SickLms291"); // Đề phòng lỗi dấu cách tên
  }
  
  if (lidar != 0) {
    wb_lidar_enable(lidar, TIME_STEP);
    printf("[OK] Đã kích hoạt Lidar \"Sick LMS 291\" (%d tia quét)\n", 
           wb_lidar_get_horizontal_resolution(lidar));
  } else {
    printf("[ẢO] Không tìm thấy thiết bị tên \"Sick LMS 291\"\n");
  }

  printf("-------------------------------------------------------\n");
  printf(" BẮT ĐẦU ĐỌC DỮ LIỆU REAL-TIME TỪ CẢM BIẾN (Mỗi 1 giây):\n");
  printf("-------------------------------------------------------\n");

  int counter = 0;

  /* VÒNG LẶP CHÍNH - ĐỌC DATA TRỰC TIẾP */
  while (wb_robot_step(TIME_STEP) != -1) {
    counter++;
    
    // Giới hạn in ra console mỗi 10 chu kỳ (~0.6 giây) một lần để tránh tràn màn hình
    if (counter % 10 == 0) {
      printf("\n--- Thời gian mô phỏng: %.2f s ---\n", wb_robot_get_time());

      // Đọc thông số cảm biến khoảng cách
      if (ds != 0) {
        double ds_val = wb_distance_sensor_get_value(ds);
        printf("  [Distance Sensor]: Giá trị thô = %.2f\n", ds_val);
      }

      // Đọc thông số từ tâm Lidar (Tia quét ở chính giữa)
      if (lidar != 0) {
        const float *lidar_range = wb_lidar_get_range_image(lidar);
        int mid_index = wb_lidar_get_horizontal_resolution(lidar) / 2;
        if (lidar_range != NULL) {
          printf("  [Lidar Sick]: Khoảng cách vật cản thẳng phía trước = %.2f mét\n", lidar_range[mid_index]);
        }
      }

      // Kiểm tra trạng thái hoạt động của Camera
      if (kinect != 0) {
        const unsigned char *image = wb_camera_get_image(kinect);
        if (image != NULL) {
          // Lấy mẫu giá trị màu RGB của pixel trung tâm ảnh
          int w = wb_camera_get_width(kinect);
          int h = wb_camera_get_height(kinect);
          int r = wb_camera_image_get_red(image, w, w/2, h/2);
          int g = wb_camera_image_get_green(image, w, w/2, h/2);
          int b = wb_camera_image_get_blue(image, w, w/2, h/2);
          printf("  [Kinect Camera]: Đang nhận hình ảnh tốt (Pixel giữa: R=%d, G=%d, B=%d)\n", r, g, b);
        } else {
          printf("  [Kinect Camera]: LỖI - Không nhận được luồng hình ảnh!\n");
        }
      }
    }
  }

  wb_robot_cleanup();
  return 0;
}