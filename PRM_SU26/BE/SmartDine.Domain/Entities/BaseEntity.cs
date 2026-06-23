namespace SmartDine.Domain.Entities;

/// <summary>
/// Base entity chung cho tất cả entity — cung cấp Id, timestamps, soft delete.
/// </summary>
public abstract class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
}
