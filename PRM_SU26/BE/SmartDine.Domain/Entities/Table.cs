using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Bàn ăn (dining_tables).
/// </summary>
public class Table : BaseEntity
{
    public int TableNumber { get; set; }
    public int Capacity { get; set; }
    public string? QrCode { get; set; }
    public string Status { get; set; } = "AVAILABLE"; // AVAILABLE, OCCUPIED

    // Navigation
    public List<DiningSession> DiningSessions { get; set; } = new();
    public List<TableReservation> Reservations { get; set; } = new();
    public List<RobotDeliveryBatch> DeliveryBatches { get; set; } = new();
}
