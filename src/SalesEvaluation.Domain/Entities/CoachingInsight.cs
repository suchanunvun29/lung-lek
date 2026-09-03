namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class CoachingInsight : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string SalespersonId { get; set; } = string.Empty;
    public Salesperson Salesperson { get; set; } = null!;
    public PeriodType PeriodType { get; set; }
    public int Year { get; set; }
    public int PeriodNumber { get; set; }
    public string KpiSnapshot { get; set; } = string.Empty;
    public string? ContentTh { get; set; }
    public InsightStatus Status { get; set; } = InsightStatus.PENDING;
    public string? Provider { get; set; }
    public string? Model { get; set; }
    public string? ErrorMessage { get; set; }
    public bool IsStale { get; set; } = false;
    public string? GeneratedById { get; set; }
    public User? GeneratedBy { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
