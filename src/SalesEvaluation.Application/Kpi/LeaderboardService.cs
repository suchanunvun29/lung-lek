namespace SalesEvaluation.Application.Kpi;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Territories;
using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Entities;

public class LeaderboardService : ILeaderboardService
{
    private readonly ITerritoryKpiService _territoryKpiService;
    private readonly ITerritoryScopeResolver _scopeResolver;
    private readonly IKpiScoringService _kpiScoringService;
    private readonly IAppDbContext _dbContext;

    public LeaderboardService(
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        IKpiScoringService kpiScoringService,
        IAppDbContext dbContext)
    {
        _territoryKpiService = territoryKpiService;
        _scopeResolver = scopeResolver;
        _kpiScoringService = kpiScoringService;
        _dbContext = dbContext;
    }

    private sealed class CriterionValue
    {
        public double? Value { get; init; }
        public bool Computable { get; init; }
        public string? Reason { get; init; }
    }

    private sealed class LeaderboardUnit
    {
        public string UnitType { get; init; } = string.Empty;
        public int Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public List<string> OwnerNames { get; init; } = new();
        public CriterionValue Criterion { get; init; } = new();
        public int? Rank { get; set; }
        public object Serialized { get; init; } = null!;
        public List<object>? Members { get; init; }
    }

    private static CriterionValue TerritoryCriterion(TerritoryKpiRowData row, string criteria)
    {
        switch (criteria)
        {
            case "COMPOSITE":
                return row.CompositeScore != null
                    ? new CriterionValue { Value = row.CompositeScore, Computable = true, Reason = null }
                    : new CriterionValue { Value = null, Computable = false, Reason = row.Message ?? "คำนวณไม่ได้" };
            case "PERCENT_TARGET":
                {
                    var metric = row.Metrics.FirstOrDefault(m => m.Metric == Domain.Enums.KpiMetric.REVENUE_VS_TARGET);
                    return metric is { Computable: true } && row.AchievementPercent != null
                        ? new CriterionValue { Value = row.AchievementPercent, Computable = true, Reason = null }
                        : new CriterionValue { Value = null, Computable = false, Reason = metric?.Reason ?? "คำนวณไม่ได้" };
                }
            case "REVENUE":
                // revenue(T) needs no target — always rankable, including 0.
                return new CriterionValue { Value = row.Revenue, Computable = true, Reason = null };
            case "NEW_CUSTOMERS":
                {
                    var metric = row.Metrics.FirstOrDefault(m => m.Metric == Domain.Enums.KpiMetric.NEW_CUSTOMERS);
                    var actual = metric != null && metric.Detail.TryGetValue("actual", out var raw) && raw is double number
                        ? number
                        : (double?)null;
                    return metric is { Computable: true } && actual != null
                        ? new CriterionValue { Value = actual, Computable = true, Reason = null }
                        : new CriterionValue { Value = null, Computable = false, Reason = metric?.Reason ?? "คำนวณไม่ได้" };
                }
            default:
                throw new ArgumentException($"Unknown criteria {criteria}", nameof(criteria));
        }
    }

    private static CriterionValue GroupCriterion(TerritoryGroupKpiRowData row, List<TerritoryKpiRowData> fullRows, string criteria)
    {
        switch (criteria)
        {
            case "COMPOSITE":
            case "PERCENT_TARGET":
                return row.AchievementPercent != null
                    ? new CriterionValue
                    {
                        Value = criteria == "COMPOSITE" ? row.CompositeScore : row.AchievementPercent,
                        Computable = true,
                        Reason = null
                    }
                    : new CriterionValue { Value = null, Computable = false, Reason = "ยังไม่ได้ตั้งเป้า" };
            case "REVENUE":
                return new CriterionValue { Value = row.Revenue, Computable = true, Reason = null };
            case "NEW_CUSTOMERS":
                {
                    // NEW_CUSTOMERS has no group-level definition in Territory KPI Rules. The group
                    // never ranks on it; the tail reason mirrors the members' own non-computable
                    // reason when uniform.
                    var memberReasons = fullRows
                        .Where(member => row.MemberTerritoryIds.Contains(member.TerritoryId))
                        .Select(member => member.Metrics.FirstOrDefault(m => m.Metric == Domain.Enums.KpiMetric.NEW_CUSTOMERS)?.Reason ?? "คำนวณไม่ได้")
                        .ToHashSet();
                    var only = memberReasons.FirstOrDefault();
                    return new CriterionValue
                    {
                        Value = null,
                        Computable = false,
                        Reason = memberReasons.Count == 1 ? only : "คำนวณไม่ได้"
                    };
                }
            default:
                throw new ArgumentException($"Unknown criteria {criteria}", nameof(criteria));
            }
    }

    // Standard competition ranking over the chosen criterion (1, 2, 2, 4). Ranking is presentation
    // ordering of service-computed values — never a second formula.
    private static void StandardCompetitionRanks(List<LeaderboardUnit> rows)
    {
        var sorted = rows
            .OrderByDescending(row => row.Criterion.Value ?? double.NegativeInfinity)
            .ToList();
        double? previousValue = null;
        var previousRank = 0;
        for (var i = 0; i < sorted.Count; i++)
        {
            var row = sorted[i];
            var value = row.Criterion.Value;
            if (value != null && previousValue == value)
            {
                row.Rank = previousRank;
            }
            else
            {
                row.Rank = i + 1;
                previousValue = value;
                previousRank = i + 1;
            }
        }
    }

    private static ThaiComparer Thai { get; } = new();

    private sealed class ThaiComparer : IComparer<string>
    {
        private readonly StringComparer _inner = StringComparer.Create(new CultureInfo("th-TH"), ignoreCase: false);
        public int Compare(string? x, string? y) => _inner.Compare(x, y);
    }

    private static object SerializeUnit(LeaderboardUnit unit)
    {
        // Data Visibility Rules ข้อ 6: the whitelist is absolute for restricted rows — the chosen
        // criterion's value/reason must never leak through the leaderboard either.
        switch (unit.Serialized)
        {
            case TerritoryKpiFullRowDto full:
                return new LeaderboardTerritoryFullUnitDto
                {
                    UnitType = unit.UnitType,
                    TerritoryId = full.TerritoryId,
                    Name = full.Name,
                    OwnerNames = full.OwnerNames,
                    Rank = unit.Rank,
                    CompositeScore = full.CompositeScore,
                    ComputedMetricLabel = full.ComputedMetricLabel,
                    CriterionReason = unit.Criterion.Reason,
                    Revenue = full.Revenue,
                    Target = full.Target,
                    TargetLabel = full.TargetLabel,
                    AchievementPercent = full.AchievementPercent,
                    Metrics = full.Metrics,
                    Message = full.Message,
                    Members = unit.Members
                };
            case TerritoryGroupKpiFullRowDto group:
                return new LeaderboardGroupFullUnitDto
                {
                    UnitType = unit.UnitType,
                    TerritoryId = group.TerritoryId,
                    Name = group.Name,
                    OwnerNames = group.OwnerNames,
                    Rank = unit.Rank,
                    CompositeScore = group.CompositeScore,
                    ComputedMetricLabel = group.ComputedMetricLabel,
                    CriterionReason = unit.Criterion.Reason,
                    MemberTerritoryIds = group.MemberTerritoryIds,
                    Revenue = group.Revenue,
                    RevenueTarget = group.RevenueTarget,
                    AchievementPercent = group.AchievementPercent,
                    Members = unit.Members
                };
            case TerritoryKpiRankOnlyRowDto rankOnly:
                return new LeaderboardRankOnlyUnitDto
                {
                    UnitType = unit.UnitType,
                    TerritoryId = rankOnly.TerritoryId,
                    Name = rankOnly.Name,
                    OwnerNames = rankOnly.OwnerNames,
                    Rank = unit.Rank,
                    CompositeScore = rankOnly.CompositeScore,
                    ComputedMetricLabel = rankOnly.ComputedMetricLabel,
                    Members = unit.Members
                };
            case TerritoryGroupKpiRankOnlyRowDto groupRankOnly:
                return new LeaderboardRankOnlyUnitDto
                {
                    UnitType = unit.UnitType,
                    TerritoryId = groupRankOnly.TerritoryId,
                    Name = groupRankOnly.Name,
                    OwnerNames = groupRankOnly.OwnerNames,
                    Rank = unit.Rank,
                    CompositeScore = groupRankOnly.CompositeScore,
                    ComputedMetricLabel = groupRankOnly.ComputedMetricLabel,
                    Members = unit.Members
                };
            default:
                throw new InvalidOperationException("Unexpected serialized row type");
        }
    }

    public async Task<LeaderboardBuildResult> BuildAsync(CurrentUserRef user, AppPeriodKey period, string criteria, CancellationToken cancellationToken = default)
    {
        var visible = await _scopeResolver.ResolveViewerTerritoryIdsAsync(user, cancellationToken);
        var fullRows = await _territoryKpiService.BuildFullTerritoryRowsAsync(period, cancellationToken);
        var groupRows = await _territoryKpiService.BuildTerritoryGroupRowsAsync(fullRows, period, cancellationToken);

        // Territories effective in a group during P appear as details under the group row, never
        // as their own ranked rows (หน่วยเป้า definition, Territory KPI Rules ข้อ 6).
        var groupedTerritoryIds = groupRows.SelectMany(g => g.MemberTerritoryIds).ToHashSet();
        var serializedByTerritoryId = new Dictionary<int, object>();
        foreach (var row in fullRows)
        {
            serializedByTerritoryId[row.TerritoryId] = _territoryKpiService.SerializeRow(row, visible);
        }

        var units = new List<LeaderboardUnit>();
        foreach (var row in fullRows)
        {
            if (groupedTerritoryIds.Contains(row.TerritoryId))
            {
                continue;
            }

            units.Add(new LeaderboardUnit
            {
                UnitType = "TERRITORY",
                Id = row.TerritoryId,
                Name = row.Name,
                OwnerNames = row.OwnerNames,
                Criterion = TerritoryCriterion(row, criteria),
                Rank = null,
                Serialized = serializedByTerritoryId[row.TerritoryId]
            });
        }

        foreach (var row in groupRows)
        {
            var members = fullRows
                .Where(member => row.MemberTerritoryIds.Contains(member.TerritoryId))
                .Select(member => _territoryKpiService.SerializeRow(member, visible))
                .ToList();
            units.Add(new LeaderboardUnit
            {
                UnitType = "GROUP",
                Id = row.TerritoryId,
                Name = $"{row.Name} (กลุ่มเขต)",
                OwnerNames = row.OwnerNames,
                Criterion = GroupCriterion(row, fullRows, criteria),
                Rank = null,
                Serialized = _territoryKpiService.SerializeGroupRow(row, visible),
                Members = members
            });
        }

        var ranked = units.Where(u => u.Criterion.Computable).ToList();
        StandardCompetitionRanks(ranked);
        var unranked = units
            .Where(u => !u.Criterion.Computable)
            .OrderBy(u => u.Name, Thai)
            .ToList();

        // Bucket blocks are MANAGER-only in the payload (Module F2 payload rule).
        var buckets = user.Role == Domain.Enums.UserRole.MANAGER
            ? await _territoryKpiService.GetBucketsAsync(period, cancellationToken)
            : null;

        return new LeaderboardBuildResult
        {
            Criteria = criteria,
            Period = period,
            Ranked = ranked
                .OrderBy(u => u.Rank ?? 0)
                .Select(SerializeUnit)
                .ToList(),
            Unranked = unranked.Select(SerializeUnit).ToList(),
            Buckets = buckets
        };
    }

    public async Task<object?> GetTerritoryPeopleAsync(
        CurrentUserRef user,
        int territoryId,
        AppPeriodKey period,
        string criteria,
        CancellationToken cancellationToken = default)
    {
        var scope = await _scopeResolver.ResolveViewerTerritoryScopeAsync(user, cancellationToken);

        // Tier-2 drill-down permissions (Data Visibility Rules ข้อ 3): MANAGER anywhere, supervisor
        // on their supervised territories only. Rights are "as of today" (ข้อ 2).
        if (scope.CanSeeAllTerritories || scope.SupervisedTerritoryIds.Contains(territoryId))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var assignments = await GetActiveAssignmentsAsync(territoryId, today, cancellationToken);

            var results = new List<LeaderboardPersonRowDto>();
            foreach (var assignment in assignments)
            {
                results.Add(new LeaderboardPersonRowDto
                {
                    Salesperson = new SalespersonSummaryDto { Id = assignment.Salesperson.Id, DisplayName = assignment.Salesperson.DisplayName },
                    Composite = await _kpiScoringService.ComputeCompositeScoreAsync(assignment.SalespersonId, period, cancellationToken)
                });
            }

            return new LeaderboardPeopleResponse { Results = results };
        }

        var selfSalespersonId = scope.SelfSalespersonId;
        if (selfSalespersonId == null)
        {
            return null;
        }

        var todayOnly = DateOnly.FromDateTime(DateTime.UtcNow);
        var hasSelfAssignment = await HasActiveAssignmentAsync(territoryId, selfSalespersonId.Value, todayOnly, cancellationToken);
        if (!hasSelfAssignment)
        {
            return null;
        }

        // Data Visibility Rules ข้อ 7: exactly { rank, totalRanked, ownValue, teamAverage } —
        // nobody else's rows leave the server.
        var entries = await _kpiScoringService.ComputeActiveSalespersonCompositesAsync(period, cancellationToken);
        var values = entries.ToDictionary(
            entry => entry.SalespersonId,
            entry => PersonCriterion(entry.Result, criteria));
        var myCriterion = values[selfSalespersonId.Value];
        var computableValues = values.Values.Where(c => c.Computable).Select(c => c.Value!.Value).ToList();
        var betterCount = myCriterion.Computable
            ? values.Values.Count(c => c.Computable && (c.Value ?? 0) > (myCriterion.Value ?? 0))
            : 0;

        return new LeaderboardSelfSummaryResponse
        {
            Criteria = criteria,
            Rank = myCriterion.Computable ? betterCount + 1 : null,
            TotalRanked = computableValues.Count,
            OwnValue = myCriterion.Value,
            OwnComputable = myCriterion.Computable,
            Reason = myCriterion.Reason,
            TeamAverage = IKpiScoringService.TeamAverageComposite(entries.Select(e => e.Result))
        };
    }

    private async Task<List<TerritoryAssignment>> GetActiveAssignmentsAsync(int territoryId, DateOnly today, CancellationToken cancellationToken)
    {
        var assignments = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Salesperson)
            .Where(a => a.TerritoryId == territoryId)
            .ToListAsync(cancellationToken);
        return assignments
            .Where(a => TerritoryScopeResolver.IsActiveToday(a, today))
            .OrderBy(a => a.EffectiveFrom)
            .ToList();
    }

    private async Task<bool> HasActiveAssignmentAsync(int territoryId, int salespersonId, DateOnly today, CancellationToken cancellationToken)
    {
        var assignments = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Where(a => a.TerritoryId == territoryId && a.SalespersonId == salespersonId)
            .ToListAsync(cancellationToken);
        return assignments.Any(a => TerritoryScopeResolver.IsActiveToday(a, today));
    }

    private static CriterionValue PersonCriterion(CompositeScoreResultDto result, string criteria)
    {
        switch (criteria)
        {
            case "COMPOSITE":
                return result.Composite != null
                    ? new CriterionValue { Value = result.Composite, Computable = true, Reason = null }
                    : new CriterionValue { Value = null, Computable = false, Reason = result.Message ?? "คำนวณไม่ได้" };
            case "PERCENT_TARGET":
            case "REVENUE":
                {
                    var metric = result.Metrics.FirstOrDefault(m => m.Metric == Domain.Enums.KpiMetric.REVENUE_VS_TARGET);
                    var actual = metric != null && metric.Detail.TryGetValue("actual", out var rawActual) && rawActual is double a ? a : (double?)null;
                    var target = metric != null && metric.Detail.TryGetValue("target", out var rawTarget) && rawTarget is double t ? t : (double?)null;
                    if (metric is not { Computable: true } || actual == null || target == null)
                    {
                        return new CriterionValue { Value = null, Computable = false, Reason = metric?.Reason ?? "คำนวณไม่ได้" };
                    }

                    return criteria == "REVENUE"
                        ? new CriterionValue { Value = actual, Computable = true, Reason = null }
                        : new CriterionValue { Value = actual!.Value / target!.Value * 100.0, Computable = true, Reason = null };
                }
            case "NEW_CUSTOMERS":
                {
                    var metric = result.Metrics.FirstOrDefault(m => m.Metric == Domain.Enums.KpiMetric.NEW_CUSTOMERS);
                    var actual = metric != null && metric.Detail.TryGetValue("actual", out var raw) && raw is double a ? a : (double?)null;
                    return metric is { Computable: true } && actual != null
                        ? new CriterionValue { Value = actual, Computable = true, Reason = null }
                        : new CriterionValue { Value = null, Computable = false, Reason = metric?.Reason ?? "คำนวณไม่ได้" };
                }
            default:
                throw new ArgumentException($"Unknown criteria {criteria}", nameof(criteria));
        }
    }
}
