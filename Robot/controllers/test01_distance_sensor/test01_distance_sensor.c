#include <webots/robot.h>
#include <webots/distance_sensor.h>
#include <stdio.h>

#define TIME_STEP 64

int main() {
  wb_robot_init();

  WbDeviceTag sharp =
      wb_robot_get_device("Sharp's IR sensor GP2Y0A41SK0F");

  WbDeviceTag us_left =
      wb_robot_get_device("Mir100UltrasonicSensor");

  WbDeviceTag us_right =
      wb_robot_get_device("Mir100UltrasonicSensor(1)");

  wb_distance_sensor_enable(sharp, TIME_STEP);
  wb_distance_sensor_enable(us_left, TIME_STEP);
  wb_distance_sensor_enable(us_right, TIME_STEP);
  
  printf("US Left Min  = %f\n",
       wb_distance_sensor_get_min_value(us_left));

printf("US Left Max  = %f\n",
       wb_distance_sensor_get_max_value(us_left));

printf("US Right Min = %f\n",
       wb_distance_sensor_get_min_value(us_right));

printf("US Right Max = %f\n",
       wb_distance_sensor_get_max_value(us_right));

 while (wb_robot_step(TIME_STEP) != -1) {

  double sharpValue =
      wb_distance_sensor_get_value(sharp);

  double leftValue =
      wb_distance_sensor_get_value(us_left);

  double rightValue =
      wb_distance_sensor_get_value(us_right);

  printf("\n===== SENSOR STATUS =====\n");

  printf("Sharp    : %.4f %s\n",
         sharpValue,
         sharpValue > 0 ? "[DETECTED]" : "[NO SIGNAL]");

  printf("US Left  : %.4f %s\n",
         leftValue,
         leftValue > 0 ? "[DETECTED]" : "[NO SIGNAL]");

  printf("US Right : %.4f %s\n",
         rightValue,
         rightValue > 0 ? "[DETECTED]" : "[NO SIGNAL]");

  printf("=========================\n");
}

  wb_robot_cleanup();
  return 0;
}