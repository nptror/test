namespace SmartDine.Domain.Entities;

/// <summary>
/// Chi tiết món ăn trong combo (combo_items).
/// </summary>
public class ComboItem : BaseEntity
{
    public int ComboId { get; set; }
    public Combo Combo { get; set; } = null!;

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    public int Quantity { get; set; }
}
