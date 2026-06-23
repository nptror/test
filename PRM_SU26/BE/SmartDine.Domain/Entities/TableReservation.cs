using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Đặt bàn trước (table_reservations).
/// </summary>
public class TableReservation : BaseEntity
{
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int TableId { get; set; }
    public Table Table { get; set; } = null!;

    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public int PartySize { get; set; }
    public DateTime ReservedAt { get; set; } = DateTime.UtcNow;
    public DateTime ReservationTime { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, CONFIRMED, CHECKED_IN, CANCELLED, NO_SHOW
    public string? Notes { get; set; }
}
