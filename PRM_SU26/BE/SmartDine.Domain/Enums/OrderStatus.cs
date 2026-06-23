namespace SmartDine.Domain.Enums;

/// <summary>
/// Trạng thái của đơn hàng trong nhà hàng.
/// </summary>
public enum OrderStatus
{
    PENDING,
    CONFIRMED,
    COOKING,
    READY,
    COMPLETED,
    CANCELLED
}
