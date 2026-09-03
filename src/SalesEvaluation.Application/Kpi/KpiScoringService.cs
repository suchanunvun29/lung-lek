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

public class KpiScoringService : IKpiScoringService
{
    private static readonly KpiMetric[] MetricOrder =
    [
        KpiMetric.REVENUE_VS_TARGET,
        KpiMetric.NEW_CUSTOMERS,
        KpiMetric.PRODUCT_GROUP,
        KpiMetric.RETENTION,
        KpiMetric.CONSISTENCY
    ];

    private static readonly HashSet<string> ScoredMetrics = new()
    {
        "REVENUE_VS_TARGET", "NEW_CUSTOMERS", "PRODUCT_GROUP", "RETENTION", "CONSISTENCY"
    };

    private static readonly HashSet<string> SupplementaryMetrics = new()
    {
        "ACTIVE_CUSTOMERS", "CHURNED_CUSTOMERS", "PRODUCT_PENETRATION", "REVENUE_BY_HOSPITAL", "MONTHLY_TREND"
    };

    private readonly IAppDbContext _dbContext;
    private readonly ITerritoryScopeResolver _scopeResolver;

    public KpiScoringService(IAppDbContext dbContext, ITerritoryScopeResolver scopeResolver)
    {
        _dbContext = dbContext;
        _scopeResolver = scopeResolver;
    }

    public static bool IsValidDrillDownMetric(string metric) =>
        ScoredMetrics.Contains(metric) || SupplementaryMetrics.Contains(metric);

    public static bool IsScoredMetric(string metric) => ScoredMetrics.Contains(metric);

    private static string InsufficientDataReason(int required, int current) =>
        $"ข้อมูลยังไม่เพียงพอ ต้องการ {required} เดือน ปัจจุบันมี {current} เดือน";

    // ---------- Credit-weighted sales access ----------
    //
    // design.md (KPI & Scoring Rules, ส่วนขยาย 2026-08-16): a salesperson's per-period figures are
    // Σ (SalesLine.total × SalesLineCredit.sharePercent ÷ 100) read through SalesLineCredit —
    // never SalesLine.salespersonId directly. Every per-person aggregation goes through here.

    private sealed record CreditedLine(
        string SalesLineId,
        string HospitalId,
        string ProductTypeId,
        int Year,
        int Month,
        double CreditedTotal);

    private sealed record NewCustomerCredit(string HospitalId, string SalesLineId, double SharePercent);

    private async Task<List<CreditedLine>> GetCreditedSalesLinesAsync(
        string salespersonId,
        List<int>? monthKeys,
        (int Year, int Month)? upToPeriodEnd,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => c.SalespersonId == salespersonId);

        if (monthKeys != null)
        {
            query = query.Where(c => monthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)));
        }

        if (upToPeriodEnd.HasValue)
        {
            var (endYear, endMonth) = upToPeriodEnd.Value;
            query = query.Where(c => c.SalesLine.Year < endYear || (c.SalesLine.Year == endYear && c.SalesLine.Month <= endMonth));
        }

        var rows = await query
            .Select(c => new
            {
                c.SalesLine.Id,
                c.SalesLine.HospitalId,
                c.SalesLine.ProductTypeId,
                c.SalesLine.Year,
                c.SalesLine.Month,
                c.SalesLine.Total,
                c.SharePercent
            })
            .ToListAsync(cancellationToken);

        return rows.Select(c => new CreditedLine(
            c.Id,
            c.HospitalId,
            c.ProductTypeId,
            c.Year,
            c.Month,
            (double)c.Total * ((double)c.SharePercent / 100.0))).ToList();
    }

    private Task<List<CreditedLine>> GetCreditedSalesLinesInMonthsAsync(
        string salespersonId,
        List<int> monthKeys,
        CancellationToken cancellationToken)
    {
        return GetCreditedSalesLinesAsync(salespersonId, monthKeys, null, cancellationToken);
    }

    public async Task<int> GetDataCoverageMonthsAsync(CancellationToken cancellationToken)
    {
        var distinctMonths = await _dbContext.SalesLines
            .AsNoTracking()
            .Select(sl => new { sl.Year, sl.Month })
            .Distinct()
            .ToListAsync(cancellationToken);
        return distinctMonths.Count;
    }

    public async Task<EvaluationSetting> GetEvaluationSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await _dbContext.EvaluationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == "singleton", cancellationToken);
        if (settings == null)
        {
            throw new InvalidOperationException("EvaluationSetting singleton row is missing — re-run the seed script");
        }

        return settings;
    }

    private async Task<Dictionary<KpiMetric, decimal>> GetScoringWeightsAsync(CancellationToken cancellationToken)
    {
        var rows = await _dbContext.ScoringWeights
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(row => row.Metric, row => (decimal)row.Weight);
    }

    private async Task<MetricResultDto> ComputeRevenueVsTargetAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var months = PeriodUtils.MonthsInPeriod(period);
        var monthKeys = PeriodUtils.MonthKeys(months);
        var creditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, monthKeys, cancellationToken);
        var targetRows = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.SalespersonId == salespersonId && t.Scope == TargetScope.SALESPERSON &&
                        monthKeys.Contains(PeriodUtils.MonthKey(t.Year, t.Month)))
            .Select(t => t.RevenueTarget)
            .ToListAsync(cancellationToken);

        var actual = creditedLines.Sum(l => l.CreditedTotal);
        var target = targetRows.Sum(t => (double)t);

        if (target == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.REVENUE_VS_TARGET,
                Computable = false,
                Score = null,
                Reason = "ยังไม่ได้ตั้งเป้า หรือเป้าเป็น 0",
                Detail = new Dictionary<string, object?> { ["actual"] = actual, ["target"] = target }
            };
        }

        var achievementPercent = actual / target * 100.0;
        return new MetricResultDto
        {
            Metric = KpiMetric.REVENUE_VS_TARGET,
            Computable = true,
            Score = Math.Min(achievementPercent, 100.0),
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["actual"] = actual,
                ["target"] = target,
                ["achievementPercent"] = achievementPercent
            }
        };
    }

    private async Task<MetricResultDto> ComputeNewCustomersAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var targetRows = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.SalespersonId == salespersonId && t.Scope == TargetScope.SALESPERSON &&
                        monthKeys.Contains(PeriodUtils.MonthKey(t.Year, t.Month)))
            .Select(t => t.NewCustomerTarget)
            .ToListAsync(cancellationToken);
        var target = targetRows.Sum();

        if (target == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.NEW_CUSTOMERS,
                Computable = false,
                Score = null,
                Reason = "ยังไม่ได้ตั้งเป้าลูกค้าใหม่",
                Detail = new Dictionary<string, object?> { ["actual"] = 0.0, ["target"] = target }
            };
        }

        var creditedLines = await GetNewCustomerCreditedLinesAsync(salespersonId, period, cancellationToken);
        var actual = creditedLines.Sum(l => l.SharePercent / 100.0);

        return new MetricResultDto
        {
            Metric = KpiMetric.NEW_CUSTOMERS,
            Computable = true,
            Score = Math.Min(actual / target * 100.0, 100.0),
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["actual"] = Math.Round(actual * 10.0, MidpointRounding.AwayFromZero) / 10.0,
                ["target"] = target,
                ["hospitalIds"] = creditedLines.Select(l => l.HospitalId).ToList()
            }
        };
    }

    // The first-ever sale of each non-pre-existing hospital, system-wide, determines which period
    // the "new customer" credit lands in — independent of who is asking. A hospital's first-sale
    // line is credited to whichever salesperson(s) hold a SalesLineCredit on it, split by
    // sharePercent (design.md: a 50/50 shared deal counts as 0.5 new customers each).
    private async Task<Dictionary<string, (string Id, int Year, int Month)>> GetFirstSalePerHospitalAsync(CancellationToken cancellationToken)
    {
        var lines = await _dbContext.SalesLines
            .AsNoTracking()
            .Where(sl => sl.Hospital != null && !sl.Hospital.IsPreExistingCustomer)
            .Select(sl => new { sl.Id, sl.HospitalId, sl.Year, sl.Month, sl.InvoiceDate, sl.CreatedAt })
            .ToListAsync(cancellationToken);

        var firstSaleByHospital = new Dictionary<string, (string, int, int)>();
        foreach (var line in lines.OrderBy(l => l.Year).ThenBy(l => l.Month).ThenBy(l => l.InvoiceDate).ThenBy(l => l.CreatedAt))
        {
            if (!firstSaleByHospital.ContainsKey(line.HospitalId))
            {
                firstSaleByHospital[line.HospitalId] = (line.Id, line.Year, line.Month);
            }
        }

        return firstSaleByHospital;
    }

    private async Task<List<NewCustomerCredit>> GetNewCustomerCreditedLinesAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var months = PeriodUtils.MonthsInPeriod(period);
        var periodKeys = months.Select(m => PeriodUtils.MonthKey(m.Year, m.Month)).ToHashSet();
        var firstSaleByHospital = await GetFirstSalePerHospitalAsync(cancellationToken);

        var firstSaleLinesInPeriod = firstSaleByHospital
            .Where(kvp => periodKeys.Contains(PeriodUtils.MonthKey(kvp.Value.Year, kvp.Value.Month)))
            .ToList();
        if (firstSaleLinesInPeriod.Count == 0)
        {
            return new List<NewCustomerCredit>();
        }

        var lineIds = firstSaleLinesInPeriod.Select(kvp => kvp.Value.Id).ToList();
        var hospitalByLineId = firstSaleLinesInPeriod.ToDictionary(kvp => kvp.Value.Id, kvp => kvp.Key);

        var credits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => c.SalespersonId == salespersonId && lineIds.Contains(c.SalesLineId))
            .Select(c => new { c.SalesLineId, c.SharePercent })
            .ToListAsync(cancellationToken);

        return credits.Select(c => new NewCustomerCredit(hospitalByLineId[c.SalesLineId], c.SalesLineId, (double)c.SharePercent)).ToList();
    }

    // Actual new-customer count regardless of whether a target is set — the scoring metric
    // short-circuits to 0 when there's no target, but the Leaderboard's "new customers" ranking
    // criterion needs the real count even with no target configured.
    public async Task<double> GetNewCustomerActualCountAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var creditedLines = await GetNewCustomerCreditedLinesAsync(salespersonId, period, cancellationToken);
        var actual = creditedLines.Sum(l => l.SharePercent / 100.0);
        return Math.Round(actual * 10.0, MidpointRounding.AwayFromZero) / 10.0;
    }

    private async Task<MetricResultDto> ComputeProductGroupAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var targetGroups = await _dbContext.TargetProductGroups
            .AsNoTracking()
            .Where(pg => pg.Target != null && pg.Target.SalespersonId == salespersonId &&
                         pg.Target.Scope == TargetScope.SALESPERSON &&
                         monthKeys.Contains(PeriodUtils.MonthKey(pg.Target.Year, pg.Target.Month)))
            .Select(pg => new { pg.ProductTypeId, pg.RevenueTarget, ProductTypeName = pg.ProductType.Name })
            .ToListAsync(cancellationToken);

        if (targetGroups.Count == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.PRODUCT_GROUP,
                Computable = false,
                Score = null,
                Reason = "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้",
                Detail = new Dictionary<string, object?> { ["groups"] = new List<object>() }
            };
        }

        var targetByType = new Dictionary<string, (double Target, string Name)>();
        foreach (var g in targetGroups)
        {
            var existing = targetByType.GetValueOrDefault(g.ProductTypeId);
            targetByType[g.ProductTypeId] = (existing.Target + (double)g.RevenueTarget, g.ProductTypeName);
        }

        var totalTarget = targetByType.Values.Sum(g => g.Target);
        if (totalTarget == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.PRODUCT_GROUP,
                Computable = false,
                Score = null,
                Reason = "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0",
                Detail = new Dictionary<string, object?> { ["groups"] = new List<object>() }
            };
        }

        var creditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, monthKeys, cancellationToken);
        var actualByType = new Dictionary<string, double>();
        foreach (var line in creditedLines)
        {
            if (!targetByType.ContainsKey(line.ProductTypeId))
            {
                continue;
            }

            actualByType[line.ProductTypeId] = actualByType.GetValueOrDefault(line.ProductTypeId) + line.CreditedTotal;
        }

        double cappedSum = 0;
        var groups = new List<object>();
        foreach (var (productTypeId, (target, name)) in targetByType)
        {
            var actual = actualByType.GetValueOrDefault(productTypeId);
            var cappedActual = Math.Min(actual, target);
            cappedSum += cappedActual;
            groups.Add(new
            {
                productTypeId,
                name,
                actual,
                target,
                cappedActual
            });
        }

        return new MetricResultDto
        {
            Metric = KpiMetric.PRODUCT_GROUP,
            Computable = true,
            Score = cappedSum / totalTarget * 100.0,
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["groups"] = groups,
                ["totalTarget"] = totalTarget,
                ["cappedSum"] = cappedSum
            }
        };
    }

    private async Task<MetricResultDto> ComputeRetentionAsync(
        string salespersonId,
        AppPeriodKey period,
        EvaluationSetting settings,
        int dataCoverageMonths,
        CancellationToken cancellationToken)
    {
        if (dataCoverageMonths < settings.MinMonthsForChurn)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.RETENTION,
                Computable = false,
                Score = null,
                Reason = InsufficientDataReason(settings.MinMonthsForChurn, dataCoverageMonths),
                Detail = new Dictionary<string, object?>()
            };
        }

        var prevMonths = PeriodUtils.MonthsInPeriod(PeriodUtils.PreviousPeriod(period));
        var curMonths = PeriodUtils.MonthsInPeriod(period);

        var prevCreditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, PeriodUtils.MonthKeys(prevMonths), cancellationToken);
        var curCreditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, PeriodUtils.MonthKeys(curMonths), cancellationToken);
        var prevHospitalIds = prevCreditedLines.Select(l => l.HospitalId).Distinct().ToList();

        if (prevHospitalIds.Count == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.RETENTION,
                Computable = false,
                Score = null,
                Reason = "ไม่มีลูกค้าในงวดก่อนหน้า",
                Detail = new Dictionary<string, object?>()
            };
        }

        var curSet = curCreditedLines.Select(l => l.HospitalId).ToHashSet();
        var retainedHospitalIds = prevHospitalIds.Where(id => curSet.Contains(id)).ToList();
        var previous = PeriodUtils.PreviousPeriod(period);

        return new MetricResultDto
        {
            Metric = KpiMetric.RETENTION,
            Computable = true,
            Score = (double)retainedHospitalIds.Count / prevHospitalIds.Count * 100.0,
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["previousHospitalCount"] = prevHospitalIds.Count,
                ["retainedHospitalCount"] = retainedHospitalIds.Count,
                ["retainedHospitalIds"] = retainedHospitalIds,
                ["previousPeriod"] = new PeriodKeyDto
                {
                    PeriodType = previous.PeriodType.ToString(),
                    Year = previous.Year,
                    PeriodNumber = previous.PeriodNumber
                }
            }
        };
    }

    private async Task<MetricResultDto> ComputeConsistencyAsync(
        string salespersonId,
        AppPeriodKey period,
        EvaluationSetting settings,
        int dataCoverageMonths,
        CancellationToken cancellationToken)
    {
        if (dataCoverageMonths < settings.MinMonthsForConsistency)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.CONSISTENCY,
                Computable = false,
                Score = null,
                Reason = InsufficientDataReason(settings.MinMonthsForConsistency, dataCoverageMonths),
                Detail = new Dictionary<string, object?>()
            };
        }

        var (endYear, endMonth) = PeriodUtils.LastMonthOfPeriod(period);
        var trailing = PeriodUtils.TrailingMonths(endYear, endMonth, settings.MinMonthsForConsistency);

        var creditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, PeriodUtils.MonthKeys(trailing), cancellationToken);
        var sumMap = new Dictionary<int, double>();
        foreach (var line in creditedLines)
        {
            var key = PeriodUtils.MonthKey(line.Year, line.Month);
            sumMap[key] = sumMap.GetValueOrDefault(key) + line.CreditedTotal;
        }

        var monthlyValues = trailing.Select(m => sumMap.GetValueOrDefault(PeriodUtils.MonthKey(m.Year, m.Month))).ToList();
        var mean = monthlyValues.Average();

        if (mean == 0)
        {
            return new MetricResultDto
            {
                Metric = KpiMetric.CONSISTENCY,
                Computable = false,
                Score = null,
                Reason = "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0",
                Detail = new Dictionary<string, object?>
                {
                    ["trailing"] = trailing.Select(m => new YearMonthDto { Year = m.Year, Month = m.Month }).ToList(),
                    ["monthlyValues"] = monthlyValues
                }
            };
        }

        var variance = monthlyValues.Sum(v => Math.Pow(v - mean, 2)) / monthlyValues.Count;
        var stddev = Math.Sqrt(variance);
        var cv = stddev / mean;

        return new MetricResultDto
        {
            Metric = KpiMetric.CONSISTENCY,
            Computable = true,
            Score = Math.Max(0, 1 - cv) * 100.0,
            Reason = null,
            Detail = new Dictionary<string, object?>
            {
                ["trailing"] = trailing.Select(m => new YearMonthDto { Year = m.Year, Month = m.Month }).ToList(),
                ["monthlyValues"] = monthlyValues,
                ["mean"] = mean,
                ["stddev"] = stddev,
                ["cv"] = cv
            }
        };
    }

    public async Task<CompositeScoreResultDto> ComputeCompositeScoreAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var settings = await GetEvaluationSettingsAsync(cancellationToken);
        var weights = await GetScoringWeightsAsync(cancellationToken);
        var dataCoverageMonths = await GetDataCoverageMonthsAsync(cancellationToken);

        var results = new List<MetricResultDto>
        {
            await ComputeRevenueVsTargetAsync(salespersonId, period, cancellationToken),
            await ComputeNewCustomersAsync(salespersonId, period, cancellationToken),
            await ComputeProductGroupAsync(salespersonId, period, cancellationToken),
            await ComputeRetentionAsync(salespersonId, period, settings, dataCoverageMonths, cancellationToken),
            await ComputeConsistencyAsync(salespersonId, period, settings, dataCoverageMonths, cancellationToken)
        };

        var orderedResults = MetricOrder
            .Select(metric => results.First(r => r.Metric == metric))
            .ToList();
        var computable = orderedResults.Where(r => r.Computable).ToList();

        if (computable.Count == 0)
        {
            return new CompositeScoreResultDto
            {
                Composite = null,
                ComputedFromCount = 0,
                ComputedFromLabel = "คิดจาก 0 จาก 5 เกณฑ์",
                Message = "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้",
                Metrics = orderedResults
            };
        }

        var weightedSum = computable.Sum(r => (double)weights.GetValueOrDefault(r.Metric) * (r.Score ?? 0));
        var weightSum = computable.Sum(r => (double)weights.GetValueOrDefault(r.Metric));

        double? composite = weightSum > 0 ? weightedSum / weightSum : null;

        return new CompositeScoreResultDto
        {
            Composite = composite.HasValue ? Math.Round(composite.Value * 100.0, MidpointRounding.AwayFromZero) / 100.0 : null,
            ComputedFromCount = computable.Count,
            ComputedFromLabel = $"คิดจาก {computable.Count} จาก 5 เกณฑ์",
            Message = composite == null
                ? "ยังไม่มีคะแนนรวม เนื่องจากน้ำหนักรวมของเกณฑ์ที่คำนวณได้เป็น 0"
                : null,
            Metrics = orderedResults
        };
    }

    // ---------- Supplementary KPIs (shown but not scored) ----------

    public async Task<SupplementaryKpisDto> ComputeSupplementaryKpisAsync(
        string salespersonId,
        AppPeriodKey period,
        EvaluationSetting settings,
        CancellationToken cancellationToken)
    {
        var months = PeriodUtils.MonthsInPeriod(period);
        var monthKeys = PeriodUtils.MonthKeys(months);
        var periodEnd = PeriodUtils.LastMonthOfPeriod(period);
        var trailing12 = PeriodUtils.TrailingMonths(periodEnd.Year, periodEnd.Month, 12);

        var periodCreditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, monthKeys, cancellationToken);
        var trendCreditedLines = await GetCreditedSalesLinesInMonthsAsync(salespersonId, PeriodUtils.MonthKeys(trailing12), cancellationToken);

        var activeHospitalIds = periodCreditedLines.Select(l => l.HospitalId).Distinct().ToList();
        var activeCustomers = new ActiveCustomersDto { Count = activeHospitalIds.Count, HospitalIds = activeHospitalIds.ToList() };

        var churnedCustomers = await ComputeChurnedCustomersAsync(salespersonId, periodEnd, settings.ChurnMonths, activeHospitalIds, cancellationToken);

        var distinctProductTypesByHospital = new Dictionary<string, HashSet<string>>();
        var revenueByProductTypeId = new Dictionary<string, double>();
        foreach (var line in periodCreditedLines)
        {
            if (!distinctProductTypesByHospital.TryGetValue(line.HospitalId, out var set))
            {
                set = new HashSet<string>();
                distinctProductTypesByHospital[line.HospitalId] = set;
            }

            set.Add(line.ProductTypeId);
            revenueByProductTypeId[line.ProductTypeId] = revenueByProductTypeId.GetValueOrDefault(line.ProductTypeId) + line.CreditedTotal;
        }

        var productTypeIds = revenueByProductTypeId.Keys.ToList();
        var productTypeNames = await _dbContext.ProductTypes
            .AsNoTracking()
            .Where(pt => productTypeIds.Contains(pt.Id))
            .Select(pt => new { pt.Id, pt.Name })
            .ToListAsync(cancellationToken);
        var productTypeNameById = productTypeNames.ToDictionary(p => p.Id, p => p.Name);

        var totalRevenueForPenetration = revenueByProductTypeId.Values.Sum();
        var avgDistinctProductTypesPerCustomer = distinctProductTypesByHospital.Count == 0
            ? 0
            : distinctProductTypesByHospital.Values.Sum(set => set.Count) / (double)distinctProductTypesByHospital.Count;

        var productPenetration = new ProductPenetrationDto
        {
            AvgDistinctProductTypesPerCustomer = avgDistinctProductTypesPerCustomer,
            ProductTypeGroupsSold = revenueByProductTypeId.Select(kvp => new ProductTypeGroupSoldDto
            {
                ProductTypeId = kvp.Key,
                Name = productTypeNameById.GetValueOrDefault(kvp.Key, kvp.Key),
                RevenueShare = totalRevenueForPenetration > 0 ? kvp.Value / totalRevenueForPenetration * 100.0 : 0
            }).ToList()
        };

        var revenueByHospitalId = new Dictionary<string, double>();
        foreach (var line in periodCreditedLines)
        {
            revenueByHospitalId[line.HospitalId] = revenueByHospitalId.GetValueOrDefault(line.HospitalId) + line.CreditedTotal;
        }

        var hospitalIds = revenueByHospitalId.Keys.ToList();
        var hospitalNames = await _dbContext.Hospitals
            .AsNoTracking()
            .Where(h => hospitalIds.Contains(h.Id))
            .Select(h => new { h.Id, h.DisplayName })
            .ToListAsync(cancellationToken);
        var hospitalNameById = hospitalNames.ToDictionary(h => h.Id, h => h.DisplayName);
        var totalRevenue = revenueByHospitalId.Values.Sum();
        var revenueShareByHospital = revenueByHospitalId
            .Select(kvp => new RevenueByHospitalEntryDto
            {
                HospitalId = kvp.Key,
                HospitalName = hospitalNameById.GetValueOrDefault(kvp.Key, kvp.Key),
                Revenue = kvp.Value,
                SharePercent = totalRevenue > 0 ? kvp.Value / totalRevenue * 100.0 : 0
            })
            .OrderByDescending(e => e.Revenue)
            .ToList();

        var trendSumMap = new Dictionary<int, double>();
        foreach (var line in trendCreditedLines)
        {
            var key = PeriodUtils.MonthKey(line.Year, line.Month);
            trendSumMap[key] = trendSumMap.GetValueOrDefault(key) + line.CreditedTotal;
        }

        var monthlyRevenueTrend = trailing12.Select(m => new MonthlyTrendEntryDto
        {
            Year = m.Year,
            Month = m.Month,
            Revenue = trendSumMap.GetValueOrDefault(PeriodUtils.MonthKey(m.Year, m.Month))
        }).ToList();

        return new SupplementaryKpisDto
        {
            ActiveCustomers = activeCustomers,
            ChurnedCustomers = churnedCustomers,
            ProductPenetration = productPenetration,
            RevenueShareByHospital = revenueShareByHospital,
            MonthlyRevenueTrend = monthlyRevenueTrend
        };
    }

    private async Task<ChurnedCustomersDto> ComputeChurnedCustomersAsync(
        string salespersonId,
        (int Year, int Month) periodEnd,
        int churnMonths,
        List<string> activeHospitalIdsInPeriod,
        CancellationToken cancellationToken)
    {
        var activeSet = activeHospitalIdsInPeriod.ToHashSet();

        var linesUpToPeriodEnd = await GetCreditedSalesLinesAsync(
            salespersonId,
            monthKeys: null,
            upToPeriodEnd: periodEnd,
            cancellationToken);

        var lastOrderByHospital = new Dictionary<string, (int Year, int Month)>();
        foreach (var line in linesUpToPeriodEnd)
        {
            var current = lastOrderByHospital.GetValueOrDefault(line.HospitalId);
            if (current == default || line.Year > current.Year || (line.Year == current.Year && line.Month > current.Month))
            {
                lastOrderByHospital[line.HospitalId] = (line.Year, line.Month);
            }
        }

        var hospitals = new List<ChurnedCustomerEntryDto>();
        foreach (var (hospitalId, lastOrder) in lastOrderByHospital)
        {
            if (activeSet.Contains(hospitalId))
            {
                continue;
            }

            var monthsSinceLastOrder = (periodEnd.Year - lastOrder.Year) * 12 + (periodEnd.Month - lastOrder.Month);
            if (monthsSinceLastOrder > churnMonths)
            {
                hospitals.Add(new ChurnedCustomerEntryDto
                {
                    HospitalId = hospitalId,
                    LastOrderYear = lastOrder.Year,
                    LastOrderMonth = lastOrder.Month,
                    MonthsSinceLastOrder = monthsSinceLastOrder
                });
            }
        }

        return new ChurnedCustomersDto { Count = hospitals.Count, Hospitals = hospitals };
    }

    // ---------- Endpoint compositions ----------

    public async Task<SalespersonKpiResponse?> GetSalespersonKpiAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);
        if (salesperson == null)
        {
            return null;
        }

        var settings = await GetEvaluationSettingsAsync(cancellationToken);
        var composite = await ComputeCompositeScoreAsync(salespersonId, period, cancellationToken);
        var supplementary = await ComputeSupplementaryKpisAsync(salespersonId, period, settings, cancellationToken);

        return new SalespersonKpiResponse
        {
            Salesperson = new SalespersonSummaryDto { Id = salesperson.Id, DisplayName = salesperson.DisplayName },
            Period = ToPeriodDto(period),
            Composite = composite,
            Supplementary = supplementary
        };
    }

    public async Task<TeamKpiResponse> GetTeamKpiAsync(CurrentUserRef user, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var scope = await _scopeResolver.ResolveViewerTerritoryScopeAsync(user, cancellationToken);
        var ids = await _scopeResolver.VisibleSalespersonIdsAsync(scope, cancellationToken);
        if (!scope.CanSeeAllTerritories && scope.SelfSalespersonId == null)
        {
            return new TeamKpiResponse
            {
                Period = ToPeriodDto(period),
                Results = new List<TeamKpiResultRow>(),
                Reason = "ACCOUNT_NOT_LINKED"
            };
        }

        var query = _dbContext.Salespeople.AsNoTracking().Where(sp => sp.IsActive);
        if (ids != null)
        {
            query = query.Where(sp => ids.Contains(sp.Id));
        }

        var salespeople = await query
            .OrderBy(sp => sp.DisplayName)
            .Select(sp => new { sp.Id, sp.DisplayName })
            .ToListAsync(cancellationToken);

        var results = new List<TeamKpiResultRow>();
        foreach (var sp in salespeople)
        {
            results.Add(new TeamKpiResultRow
            {
                Salesperson = new SalespersonSummaryDto { Id = sp.Id, DisplayName = sp.DisplayName },
                Composite = await ComputeCompositeScoreAsync(sp.Id, period, cancellationToken)
            });
        }

        return new TeamKpiResponse { Period = ToPeriodDto(period), Results = results };
    }

    // ---------- Drill-down ----------

    public async Task<KpiDrillDownResponse?> GetDrillDownAsync(
        string salespersonId,
        string metric,
        AppPeriodKey period,
        string? hospitalId,
        CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);
        if (salesperson == null)
        {
            return null;
        }

        KpiDrillDownResponse result;
        if (IsScoredMetric(metric))
        {
            result = await GetScoredMetricDrillDownAsync(salespersonId, metric, period, cancellationToken);
        }
        else
        {
            result = await GetSupplementaryDrillDownAsync(salespersonId, metric, period, hospitalId, cancellationToken);
        }

        result.Salesperson = new SalespersonSummaryDto { Id = salesperson.Id, DisplayName = salesperson.DisplayName };
        result.Period = ToPeriodDto(period);
        result.Metric = metric;
        return result;
    }

    private async Task<KpiDrillDownResponse> GetScoredMetricDrillDownAsync(string salespersonId, string metric, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));

        if (metric == "REVENUE_VS_TARGET")
        {
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => monthKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                        line.Credits.Any(c => c.SalespersonId == salespersonId),
                includeProduct: true,
                orderBy: q => q.OrderBy(l => l.Year).ThenBy(l => l.Month).ThenBy(l => l.InvoiceDate));
            return new KpiDrillDownResponse { SalesLines = salesLines };
        }

        if (metric == "NEW_CUSTOMERS")
        {
            var creditedLines = await GetNewCustomerCreditedLinesAsync(salespersonId, period, cancellationToken);
            var lineIds = creditedLines.Select(l => l.SalesLineId).ToList();
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => lineIds.Contains(line.Id),
                includeProduct: true,
                orderBy: null);
            return new KpiDrillDownResponse { SalesLines = salesLines };
        }

        if (metric == "PRODUCT_GROUP")
        {
            var targetGroups = await _dbContext.TargetProductGroups
                .AsNoTracking()
                .Where(pg => pg.Target != null && pg.Target.SalespersonId == salespersonId &&
                             monthKeys.Contains(PeriodUtils.MonthKey(pg.Target.Year, pg.Target.Month)))
                .Select(pg => pg.ProductTypeId)
                .ToListAsync(cancellationToken);
            var productTypeIds = targetGroups.Distinct().ToList();
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => productTypeIds.Contains(line.ProductTypeId) &&
                        monthKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                        line.Credits.Any(c => c.SalespersonId == salespersonId),
                includeProduct: true,
                includeProductType: true,
                orderBy: q => q.OrderBy(l => l.ProductTypeId).ThenBy(l => l.Year).ThenBy(l => l.Month));
            return new KpiDrillDownResponse { SalesLines = salesLines };
        }

        if (metric == "RETENTION")
        {
            var settings = await GetEvaluationSettingsAsync(cancellationToken);
            var dataCoverageMonths = await GetDataCoverageMonthsAsync(cancellationToken);
            var result = await ComputeRetentionAsync(salespersonId, period, settings, dataCoverageMonths, cancellationToken);
            var retainedHospitalIds = (result.Detail.GetValueOrDefault("retainedHospitalIds") as List<string>) ?? new List<string>();
            var prevMonths = PeriodUtils.MonthsInPeriod(PeriodUtils.PreviousPeriod(period));
            var allMonthKeys = monthKeys.Concat(PeriodUtils.MonthKeys(prevMonths)).Distinct().ToList();
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => retainedHospitalIds.Contains(line.HospitalId) &&
                        allMonthKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                        line.Credits.Any(c => c.SalespersonId == salespersonId),
                includeProduct: false,
                orderBy: q => q.OrderBy(l => l.HospitalId).ThenBy(l => l.Year).ThenBy(l => l.Month));
            return new KpiDrillDownResponse { SalesLines = salesLines, RetainedHospitalIds = retainedHospitalIds };
        }

        // CONSISTENCY
        var settingsForConsistency = await GetEvaluationSettingsAsync(cancellationToken);
        var (endYear, endMonth) = PeriodUtils.LastMonthOfPeriod(period);
        var trailing = PeriodUtils.TrailingMonths(endYear, endMonth, settingsForConsistency.MinMonthsForConsistency);
        var trailingKeys = PeriodUtils.MonthKeys(trailing);
        var salesLinesForConsistency = await QueryDrillDownSalesLines(cancellationToken,
            line => trailingKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                    line.Credits.Any(c => c.SalespersonId == salespersonId),
            includeProduct: false,
            orderBy: q => q.OrderBy(l => l.Year).ThenBy(l => l.Month));
        return new KpiDrillDownResponse
        {
            SalesLines = salesLinesForConsistency,
            TrailingMonths = trailing.Select(m => new YearMonthDto { Year = m.Year, Month = m.Month }).ToList()
        };
    }

    private async Task<KpiDrillDownResponse> GetSupplementaryDrillDownAsync(
        string salespersonId,
        string metric,
        AppPeriodKey period,
        string? hospitalId,
        CancellationToken cancellationToken)
    {
        var monthKeys = PeriodUtils.MonthKeys(PeriodUtils.MonthsInPeriod(period));
        var periodEnd = PeriodUtils.LastMonthOfPeriod(period);

        if (metric == "MONTHLY_TREND")
        {
            var trailing = PeriodUtils.TrailingMonths(periodEnd.Year, periodEnd.Month, 12);
            var trailingKeys = PeriodUtils.MonthKeys(trailing);
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => trailingKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                        line.Credits.Any(c => c.SalespersonId == salespersonId),
                includeProduct: false,
                orderBy: q => q.OrderBy(l => l.Year).ThenBy(l => l.Month));
            return new KpiDrillDownResponse { SalesLines = salesLines };
        }

        if (metric == "CHURNED_CUSTOMERS")
        {
            var settings = await GetEvaluationSettingsAsync(cancellationToken);
            var salesLines = await QueryDrillDownSalesLines(cancellationToken,
                line => (line.Year < periodEnd.Year || (line.Year == periodEnd.Year && line.Month <= periodEnd.Month)) &&
                        (hospitalId == null || line.HospitalId == hospitalId) &&
                        line.Credits.Any(c => c.SalespersonId == salespersonId),
                includeProduct: false,
                orderBy: q => q.OrderBy(l => l.HospitalId).ThenByDescending(l => l.Year).ThenByDescending(l => l.Month));
            return new KpiDrillDownResponse { SalesLines = salesLines, ChurnMonths = settings.ChurnMonths };
        }

        // ACTIVE_CUSTOMERS, PRODUCT_PENETRATION, REVENUE_BY_HOSPITAL all reduce to the period's sales lines
        var salesLinesForPeriod = await QueryDrillDownSalesLines(cancellationToken,
            line => monthKeys.Contains(PeriodUtils.MonthKey(line.Year, line.Month)) &&
                    (hospitalId == null || line.HospitalId == hospitalId) &&
                    line.Credits.Any(c => c.SalespersonId == salespersonId),
            includeProduct: true,
            includeProductType: true,
            orderBy: q => q.OrderBy(l => l.HospitalId).ThenBy(l => l.Year).ThenBy(l => l.Month));
        return new KpiDrillDownResponse { SalesLines = salesLinesForPeriod };
    }

    private async Task<List<KpiSalesLineDto>> QueryDrillDownSalesLines(
        CancellationToken cancellationToken,
        System.Linq.Expressions.Expression<Func<SalesLine, bool>> filter,
        bool includeProduct,
        bool includeProductType = false,
        Func<IQueryable<SalesLine>, IQueryable<SalesLine>>? orderBy = null)
    {
        var query = _dbContext.SalesLines
            .AsNoTracking()
            .Where(filter);

        if (orderBy != null)
        {
            query = orderBy(query);
        }

        var rows = await query
            .Select(line => new
            {
                Line = line,
                HospitalName = line.Hospital != null ? line.Hospital.DisplayName : null,
                ProductName = includeProduct && line.Product != null ? line.Product.Name : null,
                ProductTypeName = includeProductType && line.ProductType != null ? line.ProductType.Name : null
            })
            .ToListAsync(cancellationToken);

        return rows.Select(r => MapDrillDownSalesLine(r.Line, r.HospitalName ?? string.Empty, r.ProductName, r.ProductTypeName)).ToList();
    }

    private static KpiSalesLineDto MapDrillDownSalesLine(SalesLine line, string hospitalDisplayName, string? productName, string? productTypeName)
    {
        return new KpiSalesLineDto
        {
            Id = line.Id,
            InvoiceNo = line.InvoiceNo,
            PoNo = line.PoNo,
            InvoiceDate = line.InvoiceDate.ToDateTime(TimeOnly.MinValue),
            Year = line.Year,
            Month = line.Month,
            HospitalId = line.HospitalId,
            SalespersonId = line.SalespersonId,
            ProductId = line.ProductId,
            ProductTypeId = line.ProductTypeId,
            Lot = line.Lot,
            ExpiryDate = line.ExpiryDate?.ToDateTime(TimeOnly.MinValue),
            Province = line.Province,
            Qty = line.Qty.ToString(CultureInfo.InvariantCulture),
            UnitPrice = line.UnitPrice.ToString(CultureInfo.InvariantCulture),
            Amount = line.Amount.ToString(CultureInfo.InvariantCulture),
            Vat = line.Vat.ToString(CultureInfo.InvariantCulture),
            Total = line.Total.ToString(CultureInfo.InvariantCulture),
            RowKey = line.RowKey,
            SourceSheetName = line.SourceSheetName,
            SourceRowNumber = line.SourceRowNumber,
            ImportBatchId = line.ImportBatchId,
            CreatedAt = line.CreatedAt,
            UpdatedAt = line.UpdatedAt,
            Hospital = new KpiDrillHospitalDto { DisplayName = hospitalDisplayName },
            Product = productName == null ? null : new ProductTypeSummaryDto { Id = line.ProductId, Name = productName },
            ProductType = productTypeName == null ? null : new ProductTypeSummaryDto { Id = line.ProductTypeId, Name = productTypeName }
        };
    }

    // ---------- Team-level composites (single source) ----------

    public async Task<List<(string SalespersonId, CompositeScoreResultDto Result)>> ComputeActiveSalespersonCompositesAsync(
        AppPeriodKey period,
        CancellationToken cancellationToken = default)
    {
        var salespeople = await _dbContext.Salespeople
            .AsNoTracking()
            .Where(sp => sp.IsActive)
            .OrderBy(sp => sp.DisplayName)
            .Select(sp => sp.Id)
            .ToListAsync(cancellationToken);

        var entries = new List<(string, CompositeScoreResultDto)>();
        foreach (var id in salespeople)
        {
            entries.Add((id, await ComputeCompositeScoreAsync(id, period, cancellationToken)));
        }

        return entries;
    }

    public static PeriodKeyDto ToPeriodDto(AppPeriodKey period) => new()
    {
        PeriodType = period.PeriodType.ToString(),
        Year = period.Year,
        PeriodNumber = period.PeriodNumber
    };
}
