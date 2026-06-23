using System;
using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Phiên ăn uống (dining_sessions).
/// </summary>
public class DiningSession : BaseEntity
{
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int TableId { get; set; }
    public Table Table { get; set; } = null!;

    public string? GuestName { get; set; }
    public string? GuestPhone { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, CLOSED
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public decimal? TotalSpent { get; set; }

    // Navigation
    public List<Order> Orders { get; set; } = new();
    public List<SessionParticipant> Participants { get; set; } = new();
}
