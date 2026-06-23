using System;

namespace SmartDine.Domain.Entities;

/// <summary>
/// Bối cảnh kinh doanh (business_context_logs).
/// </summary>
public class BusinessContextLog : BaseEntity
{
    public DateOnly ContextDate { get; set; }
    public string? WeatherCondition { get; set; }
    public decimal? Temperature { get; set; }
    public bool IsWeekend { get; set; }
    public string? HolidayName { get; set; }
    public string? LocalEvent { get; set; }
    public string? Notes { get; set; }
}
