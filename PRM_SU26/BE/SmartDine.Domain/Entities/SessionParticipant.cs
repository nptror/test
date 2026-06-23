using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Thành viên tham gia phiên ăn uống (session_participants).
/// </summary>
public class SessionParticipant : BaseEntity
{
    public int SessionId { get; set; }
    public DiningSession Session { get; set; } = null!;

    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LeftAt { get; set; }
}
