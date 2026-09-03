namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;

/// <summary>Built leaderboard units — the JSON payload and the Excel export both consume this.</summary>
public class LeaderboardBuildResult
{
    public string Criteria { get; init; } = string.Empty;
    public AppPeriodKey Period { get; init; }
    public List<object> Ranked { get; init; } = new();
    public List<object> Unranked { get; init; } = new();
    /// <summary>Present only for MANAGER (Module F2 payload rule).</summary>
    public TerritoryKpiBucketsDto? Buckets { get; init; }
}

public interface ILeaderboardService
{
    /// <summary>GET /leaderboard/territories — target units ranked on the chosen criterion (standard competition 1, 2, 2, 4).</summary>
    Task<LeaderboardBuildResult> BuildAsync(CurrentUserRef user, AppPeriodKey period, string criteria, CancellationToken cancellationToken = default);

    /// <summary>GET /leaderboard/territories/:territoryId/people — FULL rows or the SELF_SUMMARY summary block. Returns null on 403.</summary>
    Task<object?> GetTerritoryPeopleAsync(CurrentUserRef user, int territoryId, AppPeriodKey period, string criteria, CancellationToken cancellationToken = default);
}
