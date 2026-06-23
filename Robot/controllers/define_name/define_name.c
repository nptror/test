#include <webots/robot.h>
#include <webots/device.h>
#include <stdio.h>

#define TIME_STEP 64

const char* getNodeTypeName(WbNodeType type) {
  switch (type) {
    case WB_NODE_ACCELEROMETER: return "Accelerometer";
    case WB_NODE_ALTIMETER: return "Altimeter";
    case WB_NODE_CAMERA: return "Camera";
    case WB_NODE_COMPASS: return "Compass";
    case WB_NODE_DISTANCE_SENSOR: return "DistanceSensor";
    case WB_NODE_EMITTER: return "Emitter";
    case WB_NODE_GPS: return "GPS";
    case WB_NODE_GYRO: return "Gyro";
    case WB_NODE_INERTIAL_UNIT: return "InertialUnit";
    case WB_NODE_LED: return "LED";
    case WB_NODE_LIDAR: return "Lidar";
    case WB_NODE_LIGHT_SENSOR: return "LightSensor";
    case WB_NODE_PEN: return "Pen";
    case WB_NODE_POSITION_SENSOR: return "PositionSensor";
    case WB_NODE_RADAR: return "Radar";
    case WB_NODE_RANGE_FINDER: return "RangeFinder";
    case WB_NODE_RECEIVER: return "Receiver";
    case WB_NODE_ROTATIONAL_MOTOR: return "RotationalMotor";
    case WB_NODE_LINEAR_MOTOR: return "LinearMotor";
    case WB_NODE_TOUCH_SENSOR: return "TouchSensor";
    case WB_NODE_VACUUM_GRIPPER: return "VacuumGripper";
    default: return "Unknown";
  }
}

int main(int argc, char **argv) {
  wb_robot_init();

  int count = wb_robot_get_number_of_devices();

  printf("\n=====================================\n");
  printf("SO THIET BI TIM THAY: %d\n", count);
  printf("=====================================\n");

  for (int i = 0; i < count; i++) {

    WbDeviceTag tag = wb_robot_get_device_by_index(i);

    const char *name = wb_device_get_name(tag);
    WbNodeType type = wb_device_get_node_type(tag);

    printf("[%02d]\n", i);
    printf("  Name : %s\n", name);
    printf("  Type : %s\n", getNodeTypeName(type));
    printf("  Tag  : %d\n", tag);
    printf("-------------------------------------\n");
  }

  printf("=====================================\n");
  printf("QUET THIET BI HOAN TAT\n");
  printf("=====================================\n");

  while (wb_robot_step(TIME_STEP) != -1) {
  }

  wb_robot_cleanup();
  return 0;
}