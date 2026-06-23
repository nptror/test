using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Robot giao món (robots).
/// </summary>
public class Robot : BaseEntity
{
    public string RobotCode { get; set; } = string.Empty;
    public string RobotName { get; set; } = string.Empty;
    public string Status { get; set; } = "AVAILABLE"; // AVAILABLE, DELIVERING, CHARGING, OFFLINE
    public int BatteryLevel { get; set; } = 100;
    public string? CurrentLocation { get; set; }

    // Navigation
    public List<RobotDeliveryBatch> DeliveryBatches { get; set; } = new();
}
