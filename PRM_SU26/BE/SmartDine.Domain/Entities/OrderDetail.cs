using System;
using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Chi tiết đơn hàng (order_details).
/// </summary>
public class OrderDetail : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int? OrderComboId { get; set; }
    public OrderCombo? OrderCombo { get; set; }

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "WAITING"; // WAITING, DOING, DONE, SERVED, CANCELLED, RETURNED

    public int? AssignedChefId { get; set; }
    public User? AssignedChef { get; set; }

    public int? CompletedById { get; set; }
    public User? CompletedBy { get; set; }

    public DateTime? CompletedAt { get; set; }

    // Navigation
    public List<OrderDetailReturn> Returns { get; set; } = new();
    public List<RobotDeliveryItem> RobotDeliveryItems { get; set; } = new();
}
