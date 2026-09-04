namespace SalesEvaluation.Contracts.Reports;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;

public class EntitySummaryDto
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public class ReportCoachingInsightDto
{
    public int Id { get; set; }
    public int SalespersonId { get; set; }
    public string PeriodType { get; set; } = string.Empty;
    public int Year { get; set; }
    public int PeriodNumber { get; set; }
    public object? KpiSnapshot { get; set; }
    public string? ContentTh { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Provider { get; set; }
    public string? Model { get; set; }
    public string? ErrorMessage { get; set; }
    public bool IsStale { get; set; }
    public int? GeneratedById { get; set; }
    public string GeneratedAt { get; set; } = string.Empty;
}

public class IndividualReportResponse
{
    public EntitySummaryDto Salesperson { get; set; } = null!;
    public PeriodKeyDto Period { get; set; } = null!;
    public PeriodKeyDto PreviousPeriod { get; set; } = null!;
    public CompositeScoreResultDto Composite { get; set; } = null!;
    public CompositeScoreResultDto PreviousComposite { get; set; } = null!;
    public SupplementaryKpisDto Supplementary { get; set; } = null!;
    public ReportCoachingInsightDto? CoachingInsight { get; set; }
}

public class TeamOverviewEntryDto
{
    public EntitySummaryDto Salesperson { get; set; } = null!;
    public CompositeScoreResultDto Composite { get; set; } = null!;
}

public class TeamOverviewResponse
{
    public PeriodKeyDto Period { get; set; } = null!;
    public List<TeamOverviewEntryDto> Results { get; set; } = new();
}
