using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Các gói Combo món ăn (combos).
/// </summary>
public class Combo : BaseEntity
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal ComboPrice { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public List<ComboItem> ComboItems { get; set; } = new();
    public List<OrderCombo> OrderCombos { get; set; } = new();
}
