using System.Collections.Generic;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Danh mục món ăn (categories).
/// </summary>
public class MenuCategory : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Navigation
    public List<MenuItem> MenuItems { get; set; } = new();
}
