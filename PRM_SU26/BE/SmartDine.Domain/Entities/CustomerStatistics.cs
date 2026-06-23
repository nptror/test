using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Thống kê khách hàng (customer_statistics).
/// </summary>
public class CustomerStatistics : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public int TotalOrders { get; set; } = 0;
    public decimal TotalSpent { get; set; } = 0.00m;
    public decimal AverageOrderValue { get; set; } = 0.00m;
    public string? FavoriteCategory { get; set; }
    public DateTime? LastOrderAt { get; set; }
    public int VisitCount { get; set; } = 0;
}
