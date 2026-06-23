#include <webots/robot.h>
#include <webots/distance_sensor.h>
#include <stdio.h>

#define TIME_STEP 64

int main() {

  wb_robot_init();

  WbDeviceTag sensors[16];
  char name[10];

  for(int i=0;i<16;i++) {

    if(i == 0)
      sprintf(name,"so0");
    else
      sprintf(name,"so%d",i);

    sensors[i] = wb_robot_get_device(name);

    wb_distance_sensor_enable(
      sensors[i],
      TIME_STEP
    );
  }

  while(wb_robot_step(TIME_STEP)!=-1){

    for(int i=0;i<16;i++){

      printf("so%d = %.2f  ",
        i,
        wb_distance_sensor_get_value(
          sensors[i]
        )
      );
    }

    printf("\n");
  }

  wb_robot_cleanup();
}