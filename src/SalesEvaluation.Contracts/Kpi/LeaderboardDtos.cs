namespace SalesEvaluation.Contracts.Kpi;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Targets;
using System.Text.Json.Serialization;

// ---------- Module F2: Leaderboard 2 tiers ----------
// Every unit's fields depend on the server-sent `visibility` level (Data Visibility Rules ข้อ 6) —
// restricted units carry exactly the whitelist. Full territory units and group units expose
// different money field names (target vs revenueTarget), matching serializeUnit in
// territoryLeaderboard.controller.ts.

public abstract class LeaderboardUnitDto
{
    public string UnitType { get; set; } = string.Empty;
    public string TerritoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
    /// <summary>null for unranked units (tail block).</summary>
    public int? Rank { get; set; }
    public double? CompositeScore { get; set; }
    public string ComputedMetricLabel { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<object>? Members { get; set; }
}

public class LeaderboardRankOnlyUnitDto : LeaderboardUnitDto
{
    public string Visibility => "TERRITORY_RANK_ONLY";
}

public class LeaderboardTerritoryFullUnitDto : LeaderboardUnitDto
{
    public string Visibility => "TERRITORY_FULL";
    public string? CriterionReason { get; set; }
    public double Revenue { get; set; }
    public double? Target { get; set; }
    public string? TargetLabel { get; set; }
    public double? AchievementPercent { get; set; }
    public List<MetricResultDto> Metrics { get; set; } = new();
    public string? Message { get; set; }
}

public class LeaderboardGroupFullUnitDto : LeaderboardUnitDto
{
    public string Visibility => "TERRITORY_FULL";
    public string? CriterionReason { get; set; }
    public List<string> MemberTerritoryIds { get; set; } = new();
    public double Revenue { get; set; }
    public double? RevenueTarget { get; set; }
    public double? AchievementPercent { get; set; }
}

public class TerritoryLeaderboardResponse
{
    public string Criteria { get; set; } = string.Empty;
    public PeriodKeyDto Period { get; set; } = new();
    public List<object> Ranked { get; set; } = new();
    public List<object> Unranked { get; set; } = new();
    public TerritoryKpiBucketsDto? Buckets { get; set; }
}

public class LeaderboardPersonRowDto
{
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
    public CompositeScoreResultDto Composite { get; set; } = null!;
}

/// <summary>GET /leaderboard/territories/:territoryId/people — tier-2 drill-down (MANAGER/supervisor).</summary>
public class LeaderboardPeopleResponse
{
    public string Mode => "FULL";
    public List<LeaderboardPersonRowDto> Results { get; set; } = new();
}

/// <summary>SELF_SUMMARY variant for plain salespeople (Data Visibility Rules ข้อ 7).</summary>
public class LeaderboardSelfSummaryResponse
{
    public string Mode => "SELF_SUMMARY";
    public string Criteria { get; set; } = string.Empty;
    public int? Rank { get; set; }
    public int TotalRanked { get; set; }
    public double? OwnValue { get; set; }
    public bool OwnComputable { get; set; }
    public string? Reason { get; set; }
    public double? TeamAverage { get; set; }
}
