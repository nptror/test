#include <webots/robot.h>
#include <webots/motor.h>
#include <webots/position_sensor.h>
#include <stdio.h>

#define TIME_STEP 64

int main() {

  wb_robot_init();

  WbDeviceTag leftMotor =
      wb_robot_get_device("left wheel");

  WbDeviceTag rightMotor =
      wb_robot_get_device("right wheel");

  WbDeviceTag leftSensor =
      wb_robot_get_device("left wheel sensor");

  WbDeviceTag rightSensor =
      wb_robot_get_device("right wheel sensor");

  wb_position_sensor_enable(leftSensor,TIME_STEP);
  wb_position_sensor_enable(rightSensor,TIME_STEP);

  wb_motor_set_position(leftMotor,INFINITY);
  wb_motor_set_position(rightMotor,INFINITY);

  wb_motor_set_velocity(leftMotor,2);
  wb_motor_set_velocity(rightMotor,2);

  while(wb_robot_step(TIME_STEP)!=-1){

    printf("Left = %.3f\n",
      wb_position_sensor_get_value(leftSensor));

    printf("Right = %.3f\n",
      wb_position_sensor_get_value(rightSensor));

    printf("----------------\n");
  }
}