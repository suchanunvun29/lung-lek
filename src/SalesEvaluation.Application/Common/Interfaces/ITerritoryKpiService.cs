namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Contracts.Common;

/// <summary>Full (unstripped) territory KPI row — the internal computation shape of buildFullTerritoryRows.</summary>
public class TerritoryKpiRowData
{
    public string TerritoryId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public List<string> OwnerNames { get; init; } = new();
    public int Rank { get; set; }
    public double Revenue { get; init; }
    public double? Target { get; init; }
    public string? TargetLabel { get; init; }
    public double? AchievementPercent { get; init; }
    public double? CompositeScore { get; init; }
    public string ComputedMetricLabel { get; init; } = string.Empty;
    public string? Message { get; init; }
    public List<MetricResultDto> Metrics { get; init; } = new();
}

/// <summary>Full (unstripped) territory-group KPI row — buildTerritoryGroupRows output.</summary>
public class TerritoryGroupKpiRowData
{
    public string TerritoryId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public List<string> OwnerNames { get; init; } = new();
    public List<string> MemberTerritoryIds { get; init; } = new();
    public int Rank { get; set; }
    public double Revenue { get; init; }
    public double? RevenueTarget { get; init; }
    public double? AchievementPercent { get; init; }
    public double? CompositeScore { get; init; }
    public string ComputedMetricLabel { get; init; } = string.Empty;
}

public interface ITerritoryKpiService
{
    /// <summary>Every active territory's full KPI row, ranked by compositeScore (standard competition 1, 2, 2, 4).</summary>
    Task<List<TerritoryKpiRowData>> BuildFullTerritoryRowsAsync(AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>Active TerritoryGroups effective in the period, aggregated from full rows — never added into territory sums.</summary>
    Task<List<TerritoryGroupKpiRowData>> BuildTerritoryGroupRowsAsync(List<TerritoryKpiRowData> fullRows, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>Owner display names inside the period-effective window; shared with Module O's ranking.</summary>
    Task<List<string>> OwnerNamesForAsync(string territoryId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>Compute-then-strip serialization (Data Visibility Rules ข้อ 6): null visible ids = see all.</summary>
    object SerializeRow(TerritoryKpiRowData row, HashSet<string>? visibleTerritoryIds);

    /// <summary>Group rows are TERRITORY_FULL only when the viewer has FULL on every member territory.</summary>
    object SerializeGroupRow(TerritoryGroupKpiRowData row, HashSet<string>? visibleTerritoryIds);

    /// <summary>Three-bucket equation chunks (MANAGER-only payload in both /territory-kpi/team and the leaderboard).</summary>
    Task<TerritoryKpiBucketsDto> GetBucketsAsync(AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /territory-kpi/:territoryId — the serialized row for one territory.</summary>
    Task<TerritoryKpiSingleResponse?> GetTerritoryKpiAsync(string territoryId, AppPeriodKey period, HashSet<string>? visibleTerritoryIds, CancellationToken cancellationToken = default);

    /// <summary>GET /territory-kpi/:territoryId/drill-down/:metric — product types and hospitals with amounts, SalesLineCredit only.</summary>
    Task<TerritoryKpiDrillDownResponse?> GetTerritoryDrillDownAsync(string territoryId, string metric, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /territory-product-ranking/:territoryId — every product with credited revenue for the territory. Returns null when the territory does not exist.</summary>
    Task<TerritoryProductRankingResponse?> GetTerritoryProductRankingAsync(string territoryId, AppPeriodKey period, CancellationToken cancellationToken = default);
}
