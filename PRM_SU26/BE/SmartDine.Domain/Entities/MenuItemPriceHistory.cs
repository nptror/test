using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Lịch sử thay đổi giá món (menu_item_price_history).
/// </summary>
public class MenuItemPriceHistory : BaseEntity
{
    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public decimal? OldPrice { get; set; }
    public decimal NewPrice { get; set; }

    public int ChangedById { get; set; }
    public User ChangedBy { get; set; } = null!;

    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Reason { get; set; }
}
