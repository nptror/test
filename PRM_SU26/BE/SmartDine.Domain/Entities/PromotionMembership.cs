namespace SmartDine.Domain.Entities;

/// <summary>
/// Áp dụng khuyến mãi theo hạng thành viên (promotion_memberships).
/// </summary>
public class PromotionMembership : BaseEntity
{
    public int PromotionId { get; set; }
    public Promotion Promotion { get; set; } = null!;

    public string MembershipLevel { get; set; } = string.Empty; // BRONZE, SILVER, GOLD, VIP
}
