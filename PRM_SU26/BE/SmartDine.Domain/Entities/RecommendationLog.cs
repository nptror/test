namespace SmartDine.Domain.Entities;

/// <summary>
/// AI Recommendation log (recommendation_logs).
/// </summary>
public class RecommendationLog : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public string? RecommendationReason { get; set; }
    public bool Clicked { get; set; } = false;
    public bool Ordered { get; set; } = false;
}
