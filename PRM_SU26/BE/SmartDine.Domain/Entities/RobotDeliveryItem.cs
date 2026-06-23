namespace SmartDine.Domain.Entities;

/// <summary>
/// Món ăn thuộc chuyến giao của Robot (robot_delivery_items).
/// </summary>
public class RobotDeliveryItem : BaseEntity
{
    public int BatchId { get; set; }
    public RobotDeliveryBatch Batch { get; set; } = null!;

    public int OrderDetailId { get; set; }
    public OrderDetail OrderDetail { get; set; } = null!;
}
