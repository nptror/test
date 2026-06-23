using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Combo trong đơn hàng (order_combos).
/// </summary>
public class OrderCombo : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int ComboId { get; set; }
    public Combo Combo { get; set; } = null!;

    public int Quantity { get; set; }
    public decimal ComboPrice { get; set; }

    // Navigation
    public List<OrderDetail> OrderDetails { get; set; } = new();
}
