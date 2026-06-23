namespace SmartDine.Domain.Entities;

/// <summary>
/// Đánh giá món ăn (reviews).
/// </summary>
public class Review : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public int Rating { get; set; } // 1-5 stars
    public string? Comment { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED, HIDDEN
}
