namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Domain.Enums;

public interface ICoachingInsightService
{
    /// <summary>
    /// GET /coaching-insights/:salespersonId — fetch existing insight for period.
    /// </summary>
    Task<CoachingInsightResponse> GetInsightAsync(
        int salespersonId,
        AppPeriodKey period,
        CurrentUserRef viewer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// POST /coaching-insights/:salespersonId/generate — generate (or regenerate) coaching insight via Gemini.
    /// Rule-based fallback if Gemini is disabled or fails.
    /// </summary>
    Task<CoachingInsightDto> GenerateInsightAsync(
        int salespersonId,
        AppPeriodKey period,
        int generatedById,
        CancellationToken cancellationToken = default);
}

public class CoachingInsightDto
{
    public int Id { get; init; }
    public int SalespersonId { get; init; }
    public string PeriodType { get; init; } = string.Empty;
    public int Year { get; init; }
    public int PeriodNumber { get; init; }
    public string KpiSnapshot { get; init; } = string.Empty;
    public string? ContentTh { get; init; }
    public string Status { get; init; } = string.Empty;
    public string? Provider { get; init; }
    public string? Model { get; init; }
    public string? ErrorMessage { get; init; }
    public bool IsStale { get; init; }
    public int? GeneratedById { get; init; }
    public DateTime GeneratedAt { get; init; }
}

public class CoachingInsightResponse
{
    public SalespersonRef Salesperson { get; init; } = null!;
    public AppPeriodKeyDto Period { get; init; } = null!;
    public CoachingInsightDto? Insight { get; init; }
    public bool CanGenerate { get; init; }
}

public class SalespersonRef
{
    public int Id { get; init; }
    public string DisplayName { get; init; } = string.Empty;
}

public class AppPeriodKeyDto
{
    public string PeriodType { get; init; } = string.Empty;
    public int Year { get; init; }
    public int PeriodNumber { get; init; }
}
