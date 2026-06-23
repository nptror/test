namespace SmartDine.Domain.Entities;

/// <summary>
/// Thống kê món ăn (menu_item_statistics).
/// </summary>
public class MenuItemStatistics : BaseEntity
{
    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public int TotalOrders { get; set; } = 0;
    public int TotalQuantitySold { get; set; } = 0;
    public decimal TotalRevenue { get; set; } = 0.00m;
    public decimal? AverageRating { get; set; }
    public int TotalFavorites { get; set; } = 0;
    public int TotalViews { get; set; } = 0;
}
