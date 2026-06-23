using System;
using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Khuyến mãi (promotions).
/// </summary>
public class Promotion : BaseEntity
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string DiscountType { get; set; } = "PERCENT"; // PERCENT, FIXED
    public decimal DiscountValue { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public List<OrderPromotion> OrderPromotions { get; set; } = new();
    public List<PromotionMembership> PromotionMemberships { get; set; } = new();
    public List<PromotionMenuItem> PromotionMenuItems { get; set; } = new();
    public List<CustomerCoupon> CustomerCoupons { get; set; } = new();
}
