namespace SalesEvaluation.Application.Kpi;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public partial class TerritoryKpiService : ITerritoryKpiService
{
    private const string NoTargetLabel = "ยังไม่ได้ตั้งเป้า";

    // Data Visibility Rules ข้อ 6 — the single whitelist constant of the system.
    private static readonly string[] TerritoryRankOnlyFields =
    [
        "territoryId", "name", "ownerNames", "rank", "compositeScore", "computedMetricLabel"
    ];

    private readonly IAppDbContext _dbContext;
    private readonly IKpiScoringService _kpiScoringService;

    public TerritoryKpiService(IAppDbContext dbContext, IKpiScoringService kpiScoringService)
    {
        _dbContext = dbContext;
        _kpiScoringService = kpiScoringService;
    }

    private static string InsufficientDataLabel(int required, int current) =>
        $"ข้อมูลยังไม่เพียงพอ (ต้องการ {required} เดือน ปัจจุบันมี {current} เดือน)";

    private static MetricResultDto Unavailable(KpiMetric metric, string reason, Dictionary<string, object?>? detail = null) => new()
    {
        Metric = metric,
        Computable = false,
        Score = null,
        Reason = reason,
        Detail = detail ?? new Dictionary<string, object?>()
    };

    /// <summary>
    /// Territory KPI Rules ข้อ 2: Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100) where
    /// hospital.territoryId = T, salesperson NOT excludedFromTerritoryTotals, period matches.
    /// Always through SalesLineCredit — never through SalesLine.salespersonId.
    /// </summary>
    private async Task<List<(int HospitalId, int ProductTypeId, double Total)>> GetTerritoryLinesAsync(
        int territoryId,
        AppPeriodKey period,
        CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var rows = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        c.SalesLine.Hospital != null && c.SalesLine.Hospital.TerritoryId == territoryId &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new { c.SharePercent, c.SalesLine.HospitalId, c.SalesLine.ProductTypeId, c.SalesLine.Total })
            .ToListAsync(cancellationToken);

        return rows.Select(r => (r.HospitalId, r.ProductTypeId, (double)r.Total * ((double)r.SharePercent / 100.0))).ToList();
    }

    private async Task<TerritoryKpiRowData> ComputeTerritoryKpiAsync(int territoryId, Territory territory, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var targetRows = await _dbContext.Targets
            .AsNoTracking()
            .Include(t => t.ProductGroupTargets).ThenInclude(pg => pg.ProductType)
            .Where(t => t.TerritoryId == territoryId && t.Scope == TargetScope.TERRITORY &&
                        monthKeys.Contains(PeriodUtils.MonthKey(t.Year, t.Month)))
            .ToListAsync(cancellationToken);
        var settings = await _kpiScoringService.GetEvaluationSettingsAsync(cancellationToken);
        var weights = await _dbContext.ScoringWeights.AsNoTracking().ToListAsync(cancellationToken);
        var weightByMetric = weights.ToDictionary(w => w.Metric, w => (double)w.Weight);
        var coverage = await _kpiScoringService.GetDataCoverageMonthsAsync(cancellationToken);

        // Territory KPI Rules ข้อ 6: a member territory of a TerritoryGroup (effective in this
        // period) has no separate target — its target column shows the group label and
        // REVENUE_VS_TARGET is not computable. Month-edge membership ranges make membership exact.
        var firstDay = PeriodUtils.FirstDayOfPeriod(period);
        var lastDay = PeriodUtils.LastDayOfPeriod(period);
        var membership = await _dbContext.TerritoryGroupMembers
            .AsNoTracking()
            .Include(m => m.Group)
            .Where(m => m.TerritoryId == territoryId && m.EffectiveFrom <= lastDay &&
                        (m.EffectiveTo == null || m.EffectiveTo >= firstDay))
            .FirstOrDefaultAsync(cancellationToken);

        var periodLines = await GetTerritoryLinesAsync(territoryId, period, cancellationToken);
        var revenue = periodLines.Sum(l => l.Total);
        var groupLabel = membership != null
            ? $"ไม่ได้ตั้งเป้าแยก (อยู่ในเป้ารวมของกลุ่ม {membership.Group.Name})"
            : null;

        MetricResultDto revenueMetric;
        double? target;
        var rawTarget = targetRows.Sum(t => (double)t.RevenueTarget);
        if (membership != null)
        {
            revenueMetric = Unavailable(KpiMetric.REVENUE_VS_TARGET, groupLabel!, new Dictionary<string, object?> { ["actual"] = revenue });
            target = null;
        }
        else
        {
            target = rawTarget;
            revenueMetric = target > 0
                ? new MetricResultDto
                {
                    Metric = KpiMetric.REVENUE_VS_TARGET,
                    Computable = true,
                    Score = Math.Min(revenue / target.Value * 100.0, 100.0),
                    Reason = null,
                    Detail = new Dictionary<string, object?>
                    {
                        ["actual"] = revenue,
                        ["target"] = target,
                        ["achievementPercent"] = revenue / target.Value * 100.0
                    }
                }
                : Unavailable(KpiMetric.REVENUE_VS_TARGET, NoTargetLabel, new Dictionary<string, object?> { ["actual"] = revenue, ["target"] = target });
        }

        var newTarget = targetRows.Sum(t => t.NewCustomerTarget);
        double newActual = 0;
        if (newTarget > 0)
        {
            var periodKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period)).ToHashSet();
            var rows = await _dbContext.SalesLines
                .AsNoTracking()
                .Where(sl => sl.Hospital != null && sl.Hospital.TerritoryId == territoryId &&
                             !sl.Hospital.IsPreExistingCustomer &&
                             sl.Credits.Any(c => !c.Salesperson.ExcludedFromTerritoryTotals))
                .OrderBy(sl => sl.Year).ThenBy(sl => sl.Month).ThenBy(sl => sl.InvoiceDate).ThenBy(sl => sl.CreatedAt)
                .Select(sl => new { sl.HospitalId, sl.Year, sl.Month })
                .ToListAsync(cancellationToken);

            // Prisma distinct: ["hospitalId"] keeps the first row per hospital per the orderBy —
            // i.e. the hospital's first-ever sale.
            var firstSales = rows.DistinctBy(r => r.HospitalId).ToList();
            newActual = firstSales.Count(row => periodKeys.Contains(PeriodUtils.MonthKey(row.Year, row.Month)));
        }

        var newMetric = newTarget > 0
            ? new MetricResultDto
            {
                Metric = KpiMetric.NEW_CUSTOMERS,
                Computable = true,
                Score = Math.Min(newActual / newTarget * 100.0, 100.0),
                Reason = null,
                Detail = new Dictionary<string, object?> { ["actual"] = newActual, ["target"] = newTarget }
            }
            : Unavailable(KpiMetric.NEW_CUSTOMERS, NoTargetLabel, new Dictionary<string, object?> { ["actual"] = newActual, ["target"] = newTarget });

        var groups = targetRows.SelectMany(t => t.ProductGroupTargets).ToList();
        MetricResultDto groupMetric;
        if (groups.Count == 0)
        {
            groupMetric = Unavailable(KpiMetric.PRODUCT_GROUP, "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้");
        }
        else
        {
            var totalGroupTarget = groups.Sum(g => (double)g.RevenueTarget);
            if (totalGroupTarget == 0)
            {
                groupMetric = Unavailable(KpiMetric.PRODUCT_GROUP, "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0");
            }
            else
            {
                var actualByType = new Dictionary<int, double>();
                foreach (var line in periodLines)
                {
                    actualByType[line.ProductTypeId] = actualByType.GetValueOrDefault(line.ProductTypeId) + line.Total;
                }

                var capped = groups.Sum(g => Math.Min(actualByType.GetValueOrDefault(g.ProductTypeId), (double)g.RevenueTarget));
                groupMetric = new MetricResultDto
                {
                    Metric = KpiMetric.PRODUCT_GROUP,
                    Computable = true,
                    Score = capped / totalGroupTarget * 100.0,
                    Reason = null,
                    Detail = new Dictionary<string, object?> { ["totalTarget"] = totalGroupTarget, ["capped"] = capped }
                };
            }
        }

        var retention = coverage < settings.MinMonthsForChurn
            ? Unavailable(KpiMetric.RETENTION, InsufficientDataLabel(settings.MinMonthsForChurn, coverage))
            : await ComputeTerritoryRetentionAsync(territoryId, period, cancellationToken);
        var consistency = coverage < settings.MinMonthsForConsistency
            ? Unavailable(KpiMetric.CONSISTENCY, InsufficientDataLabel(settings.MinMonthsForConsistency, coverage))
            : await ComputeTerritoryConsistencyAsync(territoryId, period, settings.MinMonthsForConsistency, cancellationToken);

        var metrics = new List<MetricResultDto> { revenueMetric, newMetric, groupMetric, retention, consistency };
        var available = metrics.Where(m => m.Computable).ToList();
        var weightSum = available.Sum(m => weightByMetric.GetValueOrDefault(m.Metric));
        double? composite = weightSum != 0
            ? available.Sum(m => weightByMetric.GetValueOrDefault(m.Metric) * (m.Score ?? 0)) / weightSum
            : null;

        return new TerritoryKpiRowData
        {
            TerritoryId = territoryId,
            Name = territory.Name,
            OwnerNames = await OwnerNamesForAsync(territoryId, period, cancellationToken),
            Rank = 0,
            Revenue = revenue,
            Target = target,
            TargetLabel = groupLabel,
            AchievementPercent = target is > 0 ? revenue / target.Value * 100.0 : null,
            CompositeScore = composite.HasValue ? Math.Round(composite.Value * 100.0, MidpointRounding.AwayFromZero) / 100.0 : null,
            ComputedMetricLabel = $"คิดจาก {available.Count} จาก 5 เกณฑ์",
            Message = composite == null ? "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้" : null,
            Metrics = metrics
        };
    }

    private async Task<MetricResultDto> ComputeTerritoryRetentionAsync(int territoryId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var prev = await GetTerritoryLinesAsync(territoryId, PeriodUtils.PreviousPeriod(period), cancellationToken);
        var current = await GetTerritoryLinesAsync(territoryId, period, cancellationToken);
        var prevIds = prev.Select(r => r.HospitalId).ToHashSet();
        if (prevIds.Count == 0)
        {
            return Unavailable(KpiMetric.RETENTION, "ไม่มีลูกค้าในงวดก่อนหน้า");
        }

        var currentIds = current.Select(r => r.HospitalId).ToHashSet();
        var actual = prevIds.Count(id => currentIds.Contains(id));
        return new MetricResultDto
        {
            Metric = KpiMetric.RETENTION,
            Computable = true,
            Score = (double)actual / prevIds.Count * 100.0,
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["previousHospitalCount"] = prevIds.Count,
                ["retainedHospitalCount"] = actual
            }
        };
    }

    private async Task<MetricResultDto> ComputeTerritoryConsistencyAsync(int territoryId, AppPeriodKey period, int count, CancellationToken cancellationToken)
    {
        var (endYear, endMonth) = PeriodUtils.LastMonthOfPeriod(period);
        var months = PeriodUtils.TrailingMonths(endYear, endMonth, count);

        var monthKeys = PeriodUtils.MonthKeys(months);
        var rows = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        c.SalesLine.Hospital != null && c.SalesLine.Hospital.TerritoryId == territoryId &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new { c.SharePercent, c.SalesLine.Year, c.SalesLine.Month, c.SalesLine.Total })
            .ToListAsync(cancellationToken);

        var sumsByMonth = new Dictionary<int, double>();
        foreach (var row in rows)
        {
            var key = PeriodUtils.MonthKey(row.Year, row.Month);
            sumsByMonth[key] = sumsByMonth.GetValueOrDefault(key) + (double)row.Total * ((double)row.SharePercent / 100.0);
        }

        var values = months.Select(m => sumsByMonth.GetValueOrDefault(PeriodUtils.MonthKey(m.Year, m.Month))).ToList();
        var mean = values.Sum() / values.Count;
        if (mean == 0)
        {
            return Unavailable(KpiMetric.CONSISTENCY, "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0", new Dictionary<string, object?> { ["monthlyValues"] = values });
        }

        var variance = values.Sum(v => Math.Pow(v - mean, 2)) / values.Count;
        return new MetricResultDto
        {
            Metric = KpiMetric.CONSISTENCY,
            Computable = true,
            Score = Math.Max(0, 1 - Math.Sqrt(variance) / mean) * 100.0,
            Reason = null,
            Detail = new Dictionary<string, object?> { ["monthlyValues"] = values, ["mean"] = mean }
        };
    }

    // Territory KPI Rules ข้อ 3 — the three-bucket equation:
    // Σ revenue(every territory) + personalBucket + unassignedBucket = Σ SalesLine.total (companyTotal).
    // All three chunks plus companyTotal come out together so the equation can be checked directly.
    public async Task<TerritoryKpiBucketsDto> GetBucketsAsync(AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));

        var companyRows = await _dbContext.SalesLines
            .AsNoTracking()
            .Where(sl => monthKeys.Contains(PeriodUtils.MonthKey(sl.Year, sl.Month)))
            .Select(sl => sl.Total)
            .ToListAsync(cancellationToken);
        var companyTotal = companyRows.Sum(t => (double)t);

        var credits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new
            {
                c.SharePercent,
                c.SalesLine.Total,
                Excluded = c.Salesperson.ExcludedFromTerritoryTotals,
                c.SalesLine.HospitalId,
                TerritoryId = c.SalesLine.Hospital != null ? c.SalesLine.Hospital.TerritoryId : null
            })
            .ToListAsync(cancellationToken);

        double personalBucket = 0;
        double unassignedBucket = 0;
        var unassignedHospitalIds = new HashSet<int>();
        var revenueByTerritory = new Dictionary<int, double>();
        foreach (var credit in credits)
        {
            var amount = (double)credit.Total * ((double)credit.SharePercent / 100.0);
            if (credit.Excluded)
            {
                personalBucket += amount;
            }
            else if (!credit.TerritoryId.HasValue)
            {
                unassignedBucket += amount;
                unassignedHospitalIds.Add(credit.HospitalId);
            }
            else
            {
                revenueByTerritory[credit.TerritoryId.Value] = revenueByTerritory.GetValueOrDefault(credit.TerritoryId.Value) + amount;
            }
        }

        return new TerritoryKpiBucketsDto
        {
            CompanyTotal = companyTotal,
            TerritorySum = revenueByTerritory.Values.Sum(),
            PersonalBucket = personalBucket,
            UnassignedBucket = unassignedBucket,
            PersonalBucketEntries = await GetPersonalBucketEntriesAsync(period, cancellationToken),
            UnassignedHospitalCount = unassignedHospitalIds.Count
        };
    }

    // Territory KPI Rules ข้อ 7: the personalBucket row carries the name(s) measured by their own
    // personal target, with that target and their own %to-target.
    private async Task<List<TerritoryPersonalBucketEntryDto>> GetPersonalBucketEntriesAsync(AppPeriodKey period, CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var credits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => c.Salesperson.ExcludedFromTerritoryTotals &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new { c.SalespersonId, DisplayName = c.Salesperson.DisplayName, c.SalesLine.Total, c.SharePercent })
            .ToListAsync(cancellationToken);
        if (credits.Count == 0)
        {
            return new List<TerritoryPersonalBucketEntryDto>();
        }

        var bySalesperson = new Dictionary<int, (string DisplayName, double Revenue)>();
        foreach (var credit in credits)
        {
            var entry = bySalesperson.GetValueOrDefault(credit.SalespersonId);
            entry.DisplayName = credit.DisplayName;
            entry.Revenue += (double)credit.Total * ((double)credit.SharePercent / 100.0);
            bySalesperson[credit.SalespersonId] = entry;
        }

        var salespersonIds = bySalesperson.Keys.ToList();
        var targetRows = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.Scope == TargetScope.SALESPERSON && t.SalespersonId != null &&
                        salespersonIds.Contains(t.SalespersonId.Value) &&
                        monthKeys.Contains(PeriodUtils.MonthKey(t.Year, t.Month)))
            .Select(t => new { t.SalespersonId, t.RevenueTarget })
            .ToListAsync(cancellationToken);
        var targetBySalesperson = new Dictionary<int, double>();
        foreach (var row in targetRows)
        {
            if (row.SalespersonId == null)
            {
                continue;
            }

            targetBySalesperson[row.SalespersonId.Value] = targetBySalesperson.GetValueOrDefault(row.SalespersonId.Value) + (double)row.RevenueTarget;
        }

        return bySalesperson.Select(kvp =>
        {
            var personalTarget = targetBySalesperson.GetValueOrDefault(kvp.Key);
            return new TerritoryPersonalBucketEntryDto
            {
                SalespersonId = kvp.Key,
                DisplayName = kvp.Value.DisplayName,
                Revenue = kvp.Value.Revenue,
                PersonalTarget = personalTarget,
                AchievementPercent = personalTarget != 0 ? kvp.Value.Revenue / personalTarget * 100.0 : null
            };
        }).ToList();
    }

    // Owner display follows the same period-effective window as activeOwnerCount
    // (Territory KPI Rules ข้อ 6). Shared with Module O's ranking so both show the same names.
    public async Task<List<string>> OwnerNamesForAsync(int territoryId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var firstDay = PeriodUtils.FirstDayOfPeriod(period);
        var lastDay = PeriodUtils.LastDayOfPeriod(period);
        var owners = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Salesperson)
            .Where(a => a.TerritoryId == territoryId && a.EffectiveFrom <= lastDay &&
                        (a.EffectiveTo == null || a.EffectiveTo >= firstDay))
            .OrderBy(a => a.EffectiveFrom)
            .ToListAsync(cancellationToken);
        return owners.Select(o => o.Salesperson.DisplayName).ToList();
    }

    public async Task<List<TerritoryKpiRowData>> BuildFullTerritoryRowsAsync(AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var territories = await _dbContext.Territories
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .ToListAsync(cancellationToken);

        var rows = new List<TerritoryKpiRowData>();
        foreach (var territory in territories)
        {
            rows.Add(await ComputeTerritoryKpiAsync(territory.Id, territory, period, cancellationToken));
        }

        AssignStandardCompetitionRanksByComposite(rows);
        return rows;
    }

    // Standard competition ranking on compositeScore desc (1, 2, 2, 4); territories whose score is
    // not computable keep their reason label and take the tail positions without sharing ranks.
    internal static void AssignStandardCompetitionRanksByComposite(List<TerritoryKpiRowData> rows)
    {
        var sorted = rows.OrderByDescending(r => r.CompositeScore ?? -1).ToList();
        double? previousScore = null;
        var previousRank = 0;
        for (var i = 0; i < sorted.Count; i++)
        {
            var row = sorted[i];
            if (row.CompositeScore != null && previousScore == row.CompositeScore)
            {
                row.Rank = previousRank;
            }
            else
            {
                row.Rank = i + 1;
                previousScore = row.CompositeScore;
                previousRank = i + 1;
            }
        }
    }

    internal static void AssignStandardCompetitionRanksByCompositeGroup(List<TerritoryGroupKpiRowData> rows)
    {
        var sorted = rows.OrderByDescending(r => r.CompositeScore ?? -1).ToList();
        double? previousScore = null;
        var previousRank = 0;
        for (var i = 0; i < sorted.Count; i++)
        {
            var row = sorted[i];
            if (row.CompositeScore != null && previousScore == row.CompositeScore)
            {
                row.Rank = previousRank;
            }
            else
            {
                row.Rank = i + 1;
                previousScore = row.CompositeScore;
                previousRank = i + 1;
            }
        }
    }

    public async Task<List<TerritoryGroupKpiRowData>> BuildTerritoryGroupRowsAsync(
        List<TerritoryKpiRowData> fullRows,
        AppPeriodKey period,
        CancellationToken cancellationToken = default)
    {
        var firstDay = PeriodUtils.FirstDayOfPeriod(period);
        var lastDay = PeriodUtils.LastDayOfPeriod(period);

        var groups = await _dbContext.TerritoryGroups
            .AsNoTracking()
            .Include(g => g.Members.Where(m => m.EffectiveFrom <= lastDay && (m.EffectiveTo == null || m.EffectiveTo >= firstDay)))
            .Where(g => g.IsActive && g.Members.Any(m => m.EffectiveFrom <= lastDay && (m.EffectiveTo == null || m.EffectiveTo >= firstDay)))
            .ToListAsync(cancellationToken);

        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var rows = new List<TerritoryGroupKpiRowData>();
        foreach (var group in groups)
        {
            var memberTerritoryIds = group.Members.Select(m => m.TerritoryId).ToList();
            var memberRows = fullRows.Where(r => memberTerritoryIds.Contains(r.TerritoryId)).ToList();
            var revenue = memberRows.Sum(r => r.Revenue);
            var targetRows = await _dbContext.Targets
                .AsNoTracking()
                .Where(t => t.Scope == TargetScope.TERRITORY_GROUP && t.TerritoryGroupId == group.Id &&
                            monthKeys.Contains(PeriodUtils.MonthKey(t.Year, t.Month)))
                .Select(t => t.RevenueTarget)
                .ToListAsync(cancellationToken);
            var revenueTarget = targetRows.Sum(t => (double)t);
            double? achievementPercent = revenueTarget != 0 ? revenue / revenueTarget * 100.0 : null;

            var ownerRows = await _dbContext.TerritoryAssignments
                .AsNoTracking()
                .Include(a => a.Salesperson)
                .Where(a => memberTerritoryIds.Contains(a.TerritoryId) && a.EffectiveFrom <= lastDay &&
                            (a.EffectiveTo == null || a.EffectiveTo >= firstDay))
                .ToListAsync(cancellationToken);
            var ownerNames = ownerRows.Select(r => r.Salesperson.DisplayName).Distinct().ToList();

            rows.Add(new TerritoryGroupKpiRowData
            {
                TerritoryId = group.Id,
                Name = group.Name,
                OwnerNames = ownerNames.Count > 0 ? ownerNames : new List<string> { "ยังไม่มีผู้ดูแล" },
                MemberTerritoryIds = memberTerritoryIds,
                Rank = 0,
                Revenue = revenue,
                RevenueTarget = revenueTarget,
                AchievementPercent = achievementPercent,
                CompositeScore = achievementPercent == null ? null : Math.Min(achievementPercent.Value, 100.0),
                ComputedMetricLabel = "คิดจาก 1 จาก 5 เกณฑ์"
            });
        }

        AssignStandardCompetitionRanksByCompositeGroup(rows);
        return rows;
    }

    // Data Visibility Rules ข้อ 6: everything is always computed (rank comes from all territories),
    // then fields are stripped before sending — never sent in full for the frontend to hide.
    public object SerializeRow(TerritoryKpiRowData row, HashSet<int>? visibleTerritoryIds)
    {
        if (visibleTerritoryIds == null || visibleTerritoryIds.Contains(row.TerritoryId))
        {
            return new TerritoryKpiFullRowDto
            {
                TerritoryId = row.TerritoryId,
                Name = row.Name,
                OwnerNames = row.OwnerNames,
                Revenue = row.Revenue,
                Target = row.Target,
                TargetLabel = row.TargetLabel,
                AchievementPercent = row.AchievementPercent,
                CompositeScore = row.CompositeScore,
                ComputedMetricLabel = row.ComputedMetricLabel,
                Message = row.Message,
                Metrics = row.Metrics,
                Rank = row.Rank
            };
        }

        return new TerritoryKpiRankOnlyRowDto
        {
            TerritoryId = row.TerritoryId,
            Name = row.Name,
            OwnerNames = row.OwnerNames,
            CompositeScore = row.CompositeScore,
            ComputedMetricLabel = row.ComputedMetricLabel,
            Rank = row.Rank
        };
    }

    // Strictest reading of Data Visibility Rules ข้อ 6 for group units: money fields of the group
    // aggregate every member territory's figures, so the group is TERRITORY_FULL only when the
    // viewer has FULL on all of its members.
    public object SerializeGroupRow(TerritoryGroupKpiRowData row, HashSet<int>? visibleTerritoryIds)
    {
        if (visibleTerritoryIds == null || row.MemberTerritoryIds.All(id => visibleTerritoryIds.Contains(id)))
        {
            return new TerritoryGroupKpiFullRowDto
            {
                TerritoryId = row.TerritoryId,
                Name = row.Name,
                OwnerNames = row.OwnerNames,
                MemberTerritoryIds = row.MemberTerritoryIds,
                Rank = row.Rank,
                Revenue = row.Revenue,
                RevenueTarget = row.RevenueTarget,
                AchievementPercent = row.AchievementPercent,
                CompositeScore = row.CompositeScore,
                ComputedMetricLabel = row.ComputedMetricLabel
            };
        }

        return new TerritoryGroupKpiRankOnlyRowDto
        {
            TerritoryId = row.TerritoryId,
            Name = row.Name,
            OwnerNames = row.OwnerNames,
            Rank = row.Rank,
            CompositeScore = row.CompositeScore,
            ComputedMetricLabel = row.ComputedMetricLabel
        };
    }

    public async Task<TerritoryKpiSingleResponse?> GetTerritoryKpiAsync(
        int territoryId,
        AppPeriodKey period,
        HashSet<int>? visibleTerritoryIds,
        CancellationToken cancellationToken = default)
    {
        var territory = await _dbContext.Territories
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == territoryId, cancellationToken);
        if (territory == null)
        {
            return null;
        }

        var fullRows = await BuildFullTerritoryRowsAsync(period, cancellationToken);
        var serialized = fullRows.Select(r => SerializeRow(r, visibleTerritoryIds)).ToList();
        var match = serialized.FirstOrDefault(o =>
        {
            return o switch
            {
                TerritoryKpiFullRowDto full => full.TerritoryId == territoryId,
                TerritoryKpiRankOnlyRowDto rankOnly => rankOnly.TerritoryId == territoryId,
                _ => false
            };
        });

        return new TerritoryKpiSingleResponse { Period = KpiScoringService.ToPeriodDto(period), Territory = match };
    }

    // Territory KPI Rules ข้อ 7 drill-down — product types sold and hospitals sold to with
    // amounts, through SalesLineCredit only.
    public async Task<TerritoryKpiDrillDownResponse?> GetTerritoryDrillDownAsync(
        int territoryId,
        string metric,
        AppPeriodKey period,
        CancellationToken cancellationToken = default)
    {
        var territory = await _dbContext.Territories
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == territoryId, cancellationToken);
        if (territory == null)
        {
            return null;
        }

        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var credits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        c.SalesLine.Hospital != null && c.SalesLine.Hospital.TerritoryId == territoryId &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new
            {
                c.SharePercent,
                c.SalesLine.Total,
                TypeId = c.SalesLine.ProductTypeId,
                TypeName = c.SalesLine.ProductType.Name,
                HospitalId = c.SalesLine.HospitalId,
                HospitalName = c.SalesLine.Hospital.DisplayName
            })
            .ToListAsync(cancellationToken);

        var totalsByType = new Dictionary<int, (string Name, double Revenue)>();
        var totalsByHospital = new Dictionary<int, (string Name, double Revenue)>();
        foreach (var credit in credits)
        {
            var revenue = (double)credit.Total * ((double)credit.SharePercent / 100.0);

            var existingType = totalsByType.GetValueOrDefault(credit.TypeId);
            totalsByType[credit.TypeId] = (credit.TypeName, existingType.Revenue + revenue);

            var existingHospital = totalsByHospital.GetValueOrDefault(credit.HospitalId);
            totalsByHospital[credit.HospitalId] = (credit.HospitalName, existingHospital.Revenue + revenue);
        }

        return new TerritoryKpiDrillDownResponse
        {
            Territory = new TerritoryDrillDownTerritoryDto { Id = territory.Id, Name = territory.Name },
            Metric = metric,
            ProductTypes = totalsByType
                .Select(kvp => new TerritoryDrillDownEntryDto { Id = kvp.Key, Name = kvp.Value.Name, Revenue = kvp.Value.Revenue })
                .OrderByDescending(e => e.Revenue)
                .ToList(),
            Hospitals = totalsByHospital
                .Select(kvp => new TerritoryDrillDownEntryDto { Id = kvp.Key, Name = kvp.Value.Name, Revenue = kvp.Value.Revenue })
                .OrderByDescending(e => e.Revenue)
                .ToList()
        };
    }
}

// ---------- Module O: territory product ranking ----------

public partial class TerritoryKpiService
{
    // Product Master & Ranking Rules ข้อ 4 — mandatory first-phase warning, verbatim.
    public const string ZeroSaleWarning =
        "ทะเบียนสินค้าปัจจุบันสร้างจากประวัติการขาย รายการนี้จึงหมายถึงสินค้าที่เขตอื่นขายได้แต่เขตนี้ยังไม่เคยขาย ไม่ใช่แคตตาล็อกของบริษัท";

    public async Task<TerritoryProductRankingResponse?> GetTerritoryProductRankingAsync(
        int territoryId,
        AppPeriodKey period,
        CancellationToken cancellationToken = default)
    {
        var territory = await _dbContext.Territories
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == territoryId, cancellationToken);
        if (territory == null)
        {
            return null;
        }

        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));

        var productsTask = _dbContext.Products
            .AsNoTracking()
            .Include(p => p.ProductType)
            .OrderBy(p => p.ProductType.Name)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        // revenue(T)'s Territory KPI Rules ข้อ 2 math at product grain — SalesLineCredit only,
        // excluded personnel never count toward the territory.
        var currentTask = _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        c.SalesLine.Hospital != null && c.SalesLine.Hospital.TerritoryId == territoryId &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new { c.SalesLine.ProductId, c.SalesLine.Qty, c.SalesLine.Total, c.SharePercent })
            .ToListAsync(cancellationToken);

        var historicTask = _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        c.SalesLine.Hospital != null && c.SalesLine.Hospital.TerritoryId == territoryId)
            .Select(c => c.SalesLine.ProductId)
            .ToListAsync(cancellationToken);

        var personalTask = _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => c.Salesperson.ExcludedFromTerritoryTotals &&
                        monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new { c.SalesLine.ProductId, c.SalesLine.Qty, c.SalesLine.Total, c.SharePercent })
            .ToListAsync(cancellationToken);

        await Task.WhenAll(productsTask, currentTask, historicTask, personalTask);
        var products = productsTask.Result;
        var historical = historicTask.Result.ToHashSet();

        static Dictionary<int, (double Revenue, double Quantity)> Reduce(IEnumerable<(int ProductId, decimal Qty, decimal Total, decimal Share)> rows)
        {
            var totals = new Dictionary<int, (double Revenue, double Quantity)>();
            foreach (var row in rows)
            {
                var item = totals.GetValueOrDefault(row.ProductId);
                item.Revenue += (double)row.Total * ((double)row.Share / 100.0);
                item.Quantity += (double)row.Qty * ((double)row.Share / 100.0);
                totals[row.ProductId] = item;
            }

            return totals;
        }

        var currentRows = currentTask.Result.Select(r => (r.ProductId, r.Qty, r.Total, r.SharePercent)).ToList();
        var personalRows = personalTask.Result.Select(r => (r.ProductId, r.Qty, r.Total, r.SharePercent)).ToList();
        var totals = Reduce(currentRows);
        var personalTotals = Reduce(personalRows);

        TerritoryProductRankingItemDto Serialize(Product product, Dictionary<int, (double Revenue, double Quantity)> values)
        {
            var item = values.GetValueOrDefault(product.Id);
            return new TerritoryProductRankingItemDto
            {
                ProductId = product.Id,
                // Product.code null serializes as "-" here — never null/raw id to the frontend (ข้อ 3).
                Code = product.Code ?? "-",
                Name = product.DisplayName ?? product.Name,
                ProductType = new ProductTypeSummaryDto { Id = product.ProductType.Id, Name = product.ProductType.Name },
                Revenue = item.Revenue,
                Quantity = item.Quantity
            };
        }

        var thaiComparer = StringComparer.Create(new System.Globalization.CultureInfo("th-TH"), ignoreCase: false);

        // ข้อ 3: grouped by Product type, best worst by Total inside each group; zero-revenue
        // products sink to the end of their group sorted by name with one of two explicit labels —
        // never hidden.
        var items = products
            .Select(product =>
            {
                var dto = Serialize(product, totals);
                dto.ZeroSaleStatus = totals.ContainsKey(product.Id)
                    ? null
                    : historical.Contains(product.Id) ? "SOLD_BEFORE_NOT_IN_PERIOD" : "NEVER_SOLD_IN_TERRITORY";
                return dto;
            })
            .OrderBy(item => item.ProductType.Name, thaiComparer)
            .ThenByDescending(item => item.Revenue)
            .ThenBy(item => item.Name, StringComparer.CurrentCulture)
            .ToList();

        var ownerNames = await OwnerNamesForAsync(territoryId, period, cancellationToken);
        var territoryOwners = ownerNames.Count > 0 ? ownerNames : new List<string> { "ยังไม่มีผู้ดูแล" };

        return new TerritoryProductRankingResponse
        {
            Period = KpiScoringService.ToPeriodDto(period),
            Territory = new TerritoryProductRankingTerritoryDto
            {
                Id = territory.Id,
                Name = territory.Name,
                OwnerNames = territoryOwners
            },
            Items = items,
            PersonalBucket = products
                .Where(product => personalTotals.ContainsKey(product.Id))
                .Select(product =>
                {
                    var serialized = Serialize(product, personalTotals);
                    return new TerritoryPersonalBucketItemDto
                    {
                        ProductId = serialized.ProductId,
                        Code = serialized.Code,
                        Name = serialized.Name,
                        ProductType = serialized.ProductType,
                        Revenue = serialized.Revenue,
                        Quantity = serialized.Quantity
                    };
                })
                .OrderByDescending(item => item.Revenue)
                .ToList(),
            ZeroSaleWarning = ZeroSaleWarning
        };
    }
}
