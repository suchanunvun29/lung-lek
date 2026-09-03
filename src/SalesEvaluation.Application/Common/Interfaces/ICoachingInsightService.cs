namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Domain.Enums;

public interface ICoachingInsightService
{
    /// <summary>
    /// GET /coaching-insights/:salespersonId — fetch existing insight for period.
    /// </summary>
    Task<CoachingInsightResponse> GetInsightAsync(
        string salespersonId,
        AppPeriodKey period,
        CurrentUserRef viewer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// POST /coaching-insights/:salespersonId/generate — generate (or regenerate) coaching insight via Gemini.
    /// Rule-based fallback if Gemini is disabled or fails.
    /// </summary>
    Task<CoachingInsightDto> GenerateInsightAsync(
        string salespersonId,
        AppPeriodKey period,
        string generatedById,
        CancellationToken cancellationToken = default);
}

public class CoachingInsightDto
{
    public string Id { get; init; } = string.Empty;
    public string SalespersonId { get; init; } = string.Empty;
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
    public string? GeneratedById { get; init; }
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
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
}

public class AppPeriodKeyDto
{
    public string PeriodType { get; init; } = string.Empty;
    public int Year { get; init; }
    public int PeriodNumber { get; init; }
}
