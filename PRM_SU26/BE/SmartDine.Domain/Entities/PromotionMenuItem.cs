namespace SmartDine.Domain.Entities;

/// <summary>
/// Khuyến mãi áp dụng cho món ăn cụ thể (promotion_menu_items).
/// </summary>
public class PromotionMenuItem : BaseEntity
{
    public int PromotionId { get; set; }
    public Promotion Promotion { get; set; } = null!;

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;
}
