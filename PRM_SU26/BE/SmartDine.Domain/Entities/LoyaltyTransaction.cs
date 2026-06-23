namespace SmartDine.Domain.Entities;

/// <summary>
/// Tích điểm thành viên (loyalty_transactions).
/// </summary>
public class LoyaltyTransaction : BaseEntity
{
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public int? OrderId { get; set; }
    public Order? Order { get; set; }

    public int Points { get; set; }
    public string TransactionType { get; set; } = "EARN"; // EARN, REDEEM
}
