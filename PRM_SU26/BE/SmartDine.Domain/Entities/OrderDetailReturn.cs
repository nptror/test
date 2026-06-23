namespace SmartDine.Domain.Entities;

/// <summary>
/// Yêu cầu trả món (order_detail_returns).
/// </summary>
public class OrderDetailReturn : BaseEntity
{
    public int OrderDetailId { get; set; }
    public OrderDetail OrderDetail { get; set; } = null!;

    public bool RequestedByCustomer { get; set; }
    public string? Reason { get; set; }

    public int? ApprovedById { get; set; }
    public User? ApprovedBy { get; set; }

    public decimal RefundAmount { get; set; }
}
