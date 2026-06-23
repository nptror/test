namespace SmartDine.Domain.Entities;

/// <summary>
/// Khuyến mãi áp dụng cho đơn hàng (order_promotions).
/// </summary>
public class OrderPromotion : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int PromotionId { get; set; }
    public Promotion Promotion { get; set; } = null!;

    public decimal DiscountAmount { get; set; }
}
