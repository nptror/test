namespace SmartDine.Domain.Entities;

/// <summary>
/// Hoạt động khách hàng (customer_activities).
/// </summary>
public class CustomerActivity : BaseEntity
{
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int? SessionId { get; set; }
    public DiningSession? Session { get; set; }

    public string ActivityType { get; set; } = string.Empty; // VIEW, SEARCH, FAVORITE, ORDER, REJECT_RECOMMENDATION
    public string? Payload { get; set; } // JSONB in postgres
}
