#include <webots/robot.h>
#include <webots/lidar.h>
#include <stdio.h>

#define TIME_STEP 64

int main() {

  wb_robot_init();

  WbDeviceTag lidar =
      wb_robot_get_device("Sick LMS 291");

  wb_lidar_enable(lidar,TIME_STEP);

  while(wb_robot_step(TIME_STEP)!=-1){

    const float *scan =
        wb_lidar_get_range_image(lidar);

    int resolution =
        wb_lidar_get_horizontal_resolution(
          lidar
        );

    int center = resolution/2;

    printf("Front distance = %.2f m\n",
           scan[center]);
  }

  wb_robot_cleanup();
}