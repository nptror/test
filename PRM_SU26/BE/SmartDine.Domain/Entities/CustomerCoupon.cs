using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Coupon khách hàng sở hữu (customer_coupons).
/// </summary>
public class CustomerCoupon : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public int PromotionId { get; set; }
    public Promotion Promotion { get; set; } = null!;

    public bool IsUsed { get; set; } = false;
    public DateTime? UsedAt { get; set; }
}
