namespace SmartDine.Domain.Entities;

/// <summary>
/// Nhân viên hệ thống (CHEF, STAFF, MANAGER).
/// </summary>
public class User : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "STAFF"; // CHEF, STAFF, MANAGER
    public bool IsActive { get; set; } = true;
}
