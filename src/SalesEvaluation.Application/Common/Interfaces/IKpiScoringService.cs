namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Contracts.Common;

public interface IKpiScoringService
{
    /// <summary>GET /kpi/:salespersonId — composite + supplementary. Returns null when the salesperson does not exist.</summary>
    Task<SalespersonKpiResponse?> GetSalespersonKpiAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /kpi/team — every salesperson the viewer may see; reason ACCOUNT_NOT_LINKED when the account has no salesperson link.</summary>
    Task<TeamKpiResponse> GetTeamKpiAsync(CurrentUserRef user, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /kpi/:salespersonId/drill-down/:metric — scored and supplementary metrics. Returns null when the salesperson does not exist.</summary>
    Task<KpiDrillDownResponse?> GetDrillDownAsync(string salespersonId, string metric, AppPeriodKey period, string? hospitalId, CancellationToken cancellationToken = default);

    /// <summary>The one composite-score path every module shares (dashboard, team view, leaderboard).</summary>
    Task<CompositeScoreResultDto> ComputeCompositeScoreAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>Every active salesperson's composite — team average and Module F2's SELF_SUMMARY source.</summary>
    Task<List<(string SalespersonId, CompositeScoreResultDto Result)>> ComputeActiveSalespersonCompositesAsync(AppPeriodKey period, CancellationToken cancellationToken = default);

    Task<int> GetDataCoverageMonthsAsync(CancellationToken cancellationToken = default);

    Task<SalesEvaluation.Domain.Entities.EvaluationSetting> GetEvaluationSettingsAsync(CancellationToken cancellationToken = default);

    /// <summary>Round(mean(scores) * 100) / 100 over non-null composites; null when none.</summary>
    static double? TeamAverageComposite(IEnumerable<CompositeScoreResultDto> entries)
    {
        var scores = entries.Select(e => e.Composite).Where(s => s.HasValue).Select(s => s!.Value).ToList();
        if (scores.Count == 0)
        {
            return null;
        }

        return Math.Round(scores.Average() * 100, MidpointRounding.AwayFromZero) / 100;
    }
}
