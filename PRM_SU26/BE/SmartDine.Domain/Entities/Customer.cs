using System;
using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Khách hàng thành viên (Diner).
/// </summary>
public class Customer : BaseEntity
{
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public int LoyaltyPoints { get; set; } = 0;
    public string MembershipLevel { get; set; } = "BRONZE"; // BRONZE, SILVER, GOLD, VIP
    public decimal TotalSpent { get; set; } = 0.00m;
    public int VisitCount { get; set; } = 0;
    public DateTime? LastLoginAt { get; set; }

    // Navigation
    public List<DiningSession> DiningSessions { get; set; } = new();
    public List<Review> Reviews { get; set; } = new();
    public List<CustomerActivity> Activities { get; set; } = new();
    public List<LoyaltyTransaction> LoyaltyTransactions { get; set; } = new();
    public List<CustomerCoupon> Coupons { get; set; } = new();
    public List<SessionParticipant> SessionParticipants { get; set; } = new();
    public List<TableReservation> Reservations { get; set; } = new();
    public List<RecommendationLog> RecommendationLogs { get; set; } = new();
    public CustomerStatistics? Statistics { get; set; }
}
