using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Thực đơn món ăn (menu_items).
/// </summary>
public class MenuItem : BaseEntity
{
    public int CategoryId { get; set; }
    public MenuCategory Category { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public bool IsAvailable { get; set; } = true;

    // Navigation
    public List<OrderDetail> OrderDetails { get; set; } = new();
    public List<Review> Reviews { get; set; } = new();
    public List<MenuItemPriceHistory> PriceHistory { get; set; } = new();
    public List<ComboItem> ComboItems { get; set; } = new();
    public List<PromotionMenuItem> PromotionMenuItems { get; set; } = new();
    public List<RecommendationLog> RecommendationLogs { get; set; } = new();
    public MenuItemStatistics? Statistics { get; set; }
}
