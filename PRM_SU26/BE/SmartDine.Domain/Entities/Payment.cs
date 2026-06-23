using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Hóa đơn thanh toán (payments).
/// </summary>
public class Payment : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "CASH"; // CASH, CREDIT_CARD, E_WALLET
    public string PaymentStatus { get; set; } = "SUCCESS"; // SUCCESS, PENDING, FAILED
    public DateTime? PaidAt { get; set; }
}
