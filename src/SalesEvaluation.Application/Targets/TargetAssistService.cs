namespace SalesEvaluation.Application.Targets;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Domain.TargetAssist;

// Module L — Territory & Potential Rules contract (design.md). Every formula here is computed at
// TERRITORY grain, per region. Money always flows through SalesLineCredit with the
// excludedFromTerritoryTotals filter (Territory KPI Rules ข้อ 2) — never SalesLine.salespersonId.
// This service never touches ScoringWeight or the composite score.
public class TargetAssistService : ITargetAssistService
{
    private const double DefaultTierWeight = 1.0;
    private const string MissingSettingsMessage = "EvaluationSetting singleton row is missing — re-run the seed script";

    private readonly IAppDbContext _dbContext;

    public TargetAssistService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private sealed class InvoiceAccumulator
    {
        public string InvoiceNo { get; set; } = string.Empty;
        public decimal Total { get; set; }
        public Dictionary<int, decimal> ByRegion { get; set; } = new();
        public decimal Unmapped { get; set; }
    }

    private static bool IsLinked(RegistryLinkStatus? status, int? registryId) =>
        status == RegistryLinkStatus.LINKED && registryId.HasValue;

    public async Task<TargetSuggestionPreviewDto> BuildPreviewAsync(
        int year,
        int month,
        string mode,
        double? growthRateOverride,
        IReadOnlySet<string>? reinstatedInvoiceNos,
        CancellationToken cancellationToken = default)
    {
        var settings = await _dbContext.EvaluationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException(MissingSettingsMessage);

        var growthRate = growthRateOverride ?? (double)settings.TargetGrowthRate;
        var threshold = (double)settings.TargetOutlierThreshold;
        var alpha = (double)settings.TargetSuggestionAlpha;
        var minRegionCoverage = (double)settings.MinRegionCoverage;

        // Window: the targetLookbackMonths before the target period (ข้อ 5.1); months that hold no
        // data anywhere don't count toward the divisor (Risks ข้อ 18 — the screen shows months
        // actually used).
        var previousMonth = month == 1 ? (year - 1, 12) : (year, month - 1);
        var windowMonths = PeriodUtils.TrailingMonths(previousMonth.Item1, previousMonth.Item2, settings.TargetLookbackMonths);
        var windowMonthKeys = PeriodUtils.MonthKeys(windowMonths);

        var windowMonthsHoldingData = await _dbContext.SalesLines
            .AsNoTracking()
            .Where(sl => windowMonthKeys.Contains(PeriodUtils.MonthKey(sl.Year, sl.Month)))
            .Select(sl => new { sl.Year, sl.Month })
            .Distinct()
            .ToListAsync(cancellationToken);
        var dataMonthKeys = windowMonthsHoldingData.Select(m => PeriodUtils.MonthKey(m.Year, m.Month)).ToHashSet();
        var monthsUsed = windowMonths.Count(m => dataMonthKeys.Contains(PeriodUtils.MonthKey(m.Year, m.Month)));

        var windowCredits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals &&
                        windowMonthKeys.Contains(PeriodUtils.MonthKey(c.SalesLine.Year, c.SalesLine.Month)))
            .Select(c => new
            {
                c.SharePercent,
                c.SalesLine.InvoiceNo,
                c.SalesLine.Total,
                c.SalesLine.HospitalId,
                TerritoryId = c.SalesLine.Hospital != null ? c.SalesLine.Hospital.TerritoryId : null,
                RegionId = c.SalesLine.Hospital != null && c.SalesLine.Hospital.ProvinceMapping != null
                    ? c.SalesLine.Hospital.ProvinceMapping.RegionId
                    : (int?)null
            })
            .ToListAsync(cancellationToken);

        var allTimeCredits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Select(c => new
            {
                c.SharePercent,
                Excluded = c.Salesperson.ExcludedFromTerritoryTotals,
                c.SalesLine.Total,
                TerritoryId = c.SalesLine.Hospital != null ? c.SalesLine.Hospital.TerritoryId : null,
                RegionId = c.SalesLine.Hospital != null && c.SalesLine.Hospital.ProvinceMapping != null
                    ? c.SalesLine.Hospital.ProvinceMapping.RegionId
                    : (int?)null,
                Linked = c.SalesLine.Hospital != null &&
                         c.SalesLine.Hospital.RegistryLink != null &&
                         c.SalesLine.Hospital.RegistryLink.Status == RegistryLinkStatus.LINKED &&
                         c.SalesLine.Hospital.RegistryLink.HospitalRegistryId != null
            })
            .ToListAsync(cancellationToken);

        // Awaited one at a time on purpose: a DbContext is not thread-safe, so kicking these six
        // queries off together and joining on Task.WhenAll threw "A second operation was started
        // on this context instance". They share one connection anyway, so nothing was gained.
        var regions = await _dbContext.Regions
            .AsNoTracking()
            .OrderBy(r => r.SortOrder)
            .ToListAsync(cancellationToken);
        var tierWeightRows = await _dbContext.TierWeights
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var registryMetricRows = await _dbContext.HospitalPotentialMetrics
            .AsNoTracking()
            .Where(m => m.Metric == settings.PotentialMetric && m.PeriodYear == null && m.PeriodMonth == null)
            .Select(m => new { m.HospitalRegistryId, m.Value })
            .ToListAsync(cancellationToken);
        var registries = await _dbContext.HospitalRegistries
            .AsNoTracking()
            .Select(r => new { r.Id, r.Tier, r.PotentialAdjustment })
            .ToListAsync(cancellationToken);
        var hospitals = await _dbContext.Hospitals
            .AsNoTracking()
            .Where(h => h.TerritoryId != null)
            .Select(h => new
            {
                h.Id,
                h.TerritoryId,
                RegionId = h.ProvinceMapping != null ? (int?)h.ProvinceMapping.RegionId : null,
                Linked = h.RegistryLink != null &&
                         h.RegistryLink.Status == RegistryLinkStatus.LINKED &&
                         h.RegistryLink.HospitalRegistryId != null,
                LinkedRegistryId = h.RegistryLink != null ? h.RegistryLink.HospitalRegistryId : null
            })
            .ToListAsync(cancellationToken);
        var targets = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.Scope == TargetScope.TERRITORY && t.Year == year && t.Month == month && t.TerritoryId != null)
            .Select(t => new { t.TerritoryId, t.RevenueTarget })
            .ToListAsync(cancellationToken);

        var weightByTier = tierWeightRows.ToDictionary(row => row.Tier, row => (double)row.Weight);
        var metricValueByRegistry = registryMetricRows
            .GroupBy(m => m.HospitalRegistryId)
            .ToDictionary(g => g.Key, g => (double)g.First().Value);

        // ข้อ 1 — potential(h) = metricValue × tierWeight × potentialAdjustment, only for hospitals
        // linked to a registry row that actually has the configured metric; everything else has no
        // potential at all and surfaces through coverage instead (never counted as 0-potential).
        var registryByLinkedId = registries.ToDictionary(
            r => r.Id,
            r => (Tier: r.Tier, Adjustment: (double)r.PotentialAdjustment, HasMetric: metricValueByRegistry.ContainsKey(r.Id), MetricValue: metricValueByRegistry.GetValueOrDefault(r.Id)));

        var potentialByUnitRegion = new Dictionary<int, Dictionary<int, double>>();
        var unitRegions = new Dictionary<int, HashSet<int>>(); // presence: any assigned hospital mapped to the region
        foreach (var hospital in hospitals)
        {
            var territoryId = hospital.TerritoryId!.Value;
            if (hospital.RegionId != null)
            {
                if (!unitRegions.TryGetValue(territoryId, out var regionSet))
                {
                    regionSet = new HashSet<int>();
                    unitRegions[territoryId] = regionSet;
                }

                regionSet.Add(hospital.RegionId.Value);
            }

            if (hospital.RegionId == null || !hospital.Linked || hospital.LinkedRegistryId == null)
            {
                continue;
            }

            if (!registryByLinkedId.TryGetValue(hospital.LinkedRegistryId.Value, out var registryEntry) || !registryEntry.HasMetric)
            {
                continue;
            }

            var tierKey = registryEntry.Tier ?? string.Empty;
            var potential = registryEntry.MetricValue * weightByTier.GetValueOrDefault(tierKey, DefaultTierWeight) * registryEntry.Adjustment;
            if (!potentialByUnitRegion.TryGetValue(territoryId, out var byRegion))
            {
                byRegion = new Dictionary<int, double>();
                potentialByUnitRegion[territoryId] = byRegion;
            }

            byRegion[hospital.RegionId.Value] = byRegion.GetValueOrDefault(hospital.RegionId.Value) + potential;
        }

        // Coverage (ข้อ 3) — all-time, matching how the contract's own baseline numbers were
        // computed. Region level counts everyone (registry quality vs all real money in the
        // geography); unit level applies the Territory KPI Rules ข้อ 2 pool on both sides so the
        // ratio stays consistent.
        var regionSales = new Dictionary<int, double>();
        var regionLinkedSales = new Dictionary<int, double>();
        var unitSales = new Dictionary<int, double>();
        var unitLinkedSales = new Dictionary<int, double>();
        var unitRegionLinkedSales = new Dictionary<int, Dictionary<int, double>>();
        foreach (var credit in allTimeCredits)
        {
            var amount = (double)credit.Total * ((double)credit.SharePercent / 100.0);
            var regionId = credit.RegionId;
            var territoryId = credit.TerritoryId;
            if (regionId.HasValue)
            {
                regionSales[regionId.Value] = regionSales.GetValueOrDefault(regionId.Value) + amount;
                if (credit.Linked)
                {
                    regionLinkedSales[regionId.Value] = regionLinkedSales.GetValueOrDefault(regionId.Value) + amount;
                }
            }

            if (!territoryId.HasValue || credit.Excluded)
            {
                continue;
            }

            unitSales[territoryId.Value] = unitSales.GetValueOrDefault(territoryId.Value) + amount;
            if (!credit.Linked)
            {
                continue;
            }

            unitLinkedSales[territoryId.Value] = unitLinkedSales.GetValueOrDefault(territoryId.Value) + amount;
            if (regionId.HasValue)
            {
                if (!unitRegionLinkedSales.TryGetValue(territoryId.Value, out var byRegionSales))
                {
                    byRegionSales = new Dictionary<int, double>();
                    unitRegionLinkedSales[territoryId.Value] = byRegionSales;
                }

                byRegionSales[regionId.Value] = byRegionSales.GetValueOrDefault(regionId.Value) + amount;
            }
        }

        // History deals per unit (ข้อ 5.1): group window credits by invoiceNo within the unit,
        // split into mapped-region buckets and the unmapped bucket. Unassigned hospitals belong
        // to no unit.
        var invoicesByUnit = new Dictionary<int, Dictionary<string, InvoiceAccumulator>>();
        var unmappedHospitalIdsByUnit = new Dictionary<int, HashSet<int>>();
        foreach (var credit in windowCredits)
        {
            var territoryId = credit.TerritoryId;
            if (!territoryId.HasValue)
            {
                continue;
            }

            if (!invoicesByUnit.TryGetValue(territoryId.Value, out var invoices))
            {
                invoices = new Dictionary<string, InvoiceAccumulator>();
                invoicesByUnit[territoryId.Value] = invoices;
            }

            var invoiceNo = credit.InvoiceNo;
            if (!invoices.TryGetValue(invoiceNo, out var invoice))
            {
                invoice = new InvoiceAccumulator
                {
                    InvoiceNo = invoiceNo,
                    Total = 0m,
                    ByRegion = new Dictionary<int, decimal>(),
                    Unmapped = 0m
                };
                invoices[invoiceNo] = invoice;
            }

            var amount = credit.Total * (credit.SharePercent / 100.0m);
            invoice.Total += amount;
            if (credit.RegionId.HasValue)
            {
                invoice.ByRegion[credit.RegionId.Value] = invoice.ByRegion.GetValueOrDefault(credit.RegionId.Value) + amount;
            }
            else
            {
                invoice.Unmapped += amount;
                if (!unmappedHospitalIdsByUnit.TryGetValue(territoryId.Value, out var hospitalIds))
                {
                    hospitalIds = new HashSet<int>();
                    unmappedHospitalIdsByUnit[territoryId.Value] = hospitalIds;
                }

                hospitalIds.Add(credit.HospitalId);
            }
        }

        var reinstated = reinstatedInvoiceNos ?? new HashSet<string>();
        var cutsByUnit = new Dictionary<int, OutlierCutResult>();
        foreach (var (territoryId, invoices) in invoicesByUnit)
        {
            var unitInvoices = invoices.Values.Select(inv => new UnitInvoice
            {
                InvoiceNo = inv.InvoiceNo,
                Total = inv.Total,
                ByRegion = inv.ByRegion,
                Unmapped = inv.Unmapped
            }).ToList();
            cutsByUnit[territoryId] = OutlierCutCalculator.ApplyOutlierCut(unitInvoices, (decimal)threshold, reinstated);
        }

        // Regions to render: any region with coverage data, unit presence, or unit history
        // (before-cut membership so a fully-cut unit keeps its row — cutting must stay visible).
        var activeRegionIds = new HashSet<int>(regionSales.Keys);
        foreach (var regionIds in unitRegions.Values)
        {
            activeRegionIds.UnionWith(regionIds);
        }

        foreach (var cut in cutsByUnit.Values)
        {
            foreach (var regionId in cut.BeforeByRegion.Keys)
            {
                activeRegionIds.Add(regionId);
            }

            foreach (var regionId in cut.AfterByRegion.Keys)
            {
                activeRegionIds.Add(regionId);
            }
        }

        var sortedRegions = regions.Where(r => activeRegionIds.Contains(r.Id)).ToList();
        var territoryRows = await _dbContext.Territories
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .ToListAsync(cancellationToken);
        var territoryNameById = territoryRows.ToDictionary(t => t.Id, t => t.Name);
        var targetByTerritory = targets
            .Where(t => t.TerritoryId.HasValue)
            .ToDictionary(t => t.TerritoryId!.Value, t => (double)t.RevenueTarget);

        var missingByRegionName = new Dictionary<string, List<string>>();
        var regionResults = new List<RegionSuggestionGroupDto>();
        foreach (var region in sortedRegions)
        {
            var regionId = region.Id;
            var unitIds = new HashSet<int>(potentialByUnitRegion.GetValueOrDefault(regionId)?.Keys ?? Enumerable.Empty<int>());
            if (unitRegions.TryGetValue(regionId, out var presence))
            {
                unitIds.UnionWith(presence);
            }

            foreach (var (territoryId, cut) in cutsByUnit)
            {
                if (cut.BeforeByRegion.ContainsKey(regionId) || cut.AfterByRegion.ContainsKey(regionId))
                {
                    unitIds.Add(territoryId);
                }
            }

            if (mode == "REBALANCE")
            {
                var lacking = unitIds.Where(territoryId => !targetByTerritory.ContainsKey(territoryId)).ToList();
                if (lacking.Count > 0)
                {
                    missingByRegionName[region.Name] = lacking.Select(territoryId => territoryNameById.GetValueOrDefault(territoryId, territoryId.ToString())).ToList();
                }
            }

            Dictionary<int, decimal>? rebalanceTargets = null;
            if (mode == "REBALANCE")
            {
                rebalanceTargets = unitIds.ToDictionary(territoryId => territoryId, territoryId => (decimal)targetByTerritory.GetValueOrDefault(territoryId));
            }

            var total = regionSales.GetValueOrDefault(regionId);
            var linked = regionLinkedSales.GetValueOrDefault(regionId);
            double? regionCoverage = total > 0 ? linked / total : null;

            var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
                (decimal?)regionCoverage,
                (decimal)minRegionCoverage,
                (decimal)alpha,
                monthsUsed,
                (decimal)growthRate,
                rebalanceTargets,
                unitIds.Select(territoryId =>
                {
                    cutsByUnit.TryGetValue(territoryId, out var cut);
                    var unitTotal = unitSales.GetValueOrDefault(territoryId);
                    return new RegionUnitInput
                    {
                        TerritoryId = territoryId,
                        Potential = (decimal)(potentialByUnitRegion.GetValueOrDefault(territoryId)?.GetValueOrDefault(regionId) ?? 0),
                        TerritoryCoverage = unitTotal > 0 ? (decimal?)(unitLinkedSales.GetValueOrDefault(territoryId) / unitTotal) : null,
                        HistoryBase = cut?.AfterByRegion.GetValueOrDefault(regionId) ?? 0m
                    };
                }));

            regionResults.Add(new RegionSuggestionGroupDto
            {
                RegionId = regionId,
                RegionName = region.Name,
                CoveragePass = result.CoveragePass,
                RegionCoverage = regionCoverage,
                R = (double)result.R,
                SuggestedSum = (double)result.SuggestedSum,
                DifferenceFromR = (double)(result.SuggestedSum - result.R),
                Territories = result.Rows.Select(row =>
                {
                    cutsByUnit.TryGetValue(row.TerritoryId, out var cut);
                    // ข้อ 4 — display-only: linked sales ÷ potential, baht per potential unit,
                    // never a %.
                    var linkedInRegion = unitRegionLinkedSales.GetValueOrDefault(row.TerritoryId)?.GetValueOrDefault(regionId) ?? 0;
                    return new TerritorySuggestionRowDto
                    {
                        TerritoryId = row.TerritoryId,
                        TerritoryName = territoryNameById.GetValueOrDefault(row.TerritoryId, row.TerritoryId.ToString()),
                        Potential = (double)row.Potential,
                        PotentialShare = (double)row.PotentialShare,
                        TerritoryCoverage = (double?)row.TerritoryCoverage,
                        HistoryBeforeCut = (double)(cut?.BeforeByRegion.GetValueOrDefault(regionId) ?? 0m),
                        HistoryAfterCut = (double)(cut?.AfterByRegion.GetValueOrDefault(regionId) ?? 0m),
                        HistoryBased = (double)row.HistoryBased,
                        PotentialBased = (double)row.PotentialBased,
                        W = (double)row.W,
                        Suggested = (double)row.Suggested,
                        PenetrationIndex = row.Potential > 0 ? (double?)(linkedInRegion / (double)row.Potential) : null
                    };
                }).ToList()
            });
        }

        // ข้อ 5.4 — the unmapped chunk per unit passes the history side 100% (no blending, no
        // gate) and joins only the per-unit total, never any region's R.
        var unmapped = cutsByUnit
            .Select(kvp =>
            {
                var (territoryId, cut) = kvp;
                return new UnmappedBaseEntryDto
                {
                    TerritoryId = territoryId,
                    TerritoryName = territoryNameById.GetValueOrDefault(territoryId, territoryId.ToString()),
                    UnmappedBase = (double)RegionSuggestionCalculator.MonthlyHistoryValue(cut.AfterUnmapped, monthsUsed, (decimal)growthRate),
                    UnmappedHospitalCount = unmappedHospitalIdsByUnit.GetValueOrDefault(territoryId)?.Count ?? 0
                };
            })
            .OrderBy(e => e.TerritoryName, StringComparer.Create(new CultureInfo("th-TH"), ignoreCase: false))
            .ToList();

        // ข้อ 5.5 — suggested(unit) = Σ suggested(unit, region) over every region + unmappedBase.
        var totals = territoryRows
            .Select(territory =>
            {
                var suggestedFromRegions = regionResults.Sum(region =>
                    region.Territories.FirstOrDefault(row => row.TerritoryId == territory.Id)?.Suggested ?? 0);
                var unmappedEntry = unmapped.FirstOrDefault(entry => entry.TerritoryId == territory.Id);
                return new TerritorySuggestedTotalDto
                {
                    TerritoryId = territory.Id,
                    TerritoryName = territory.Name,
                    SuggestedTotal = suggestedFromRegions + (unmappedEntry?.UnmappedBase ?? 0)
                };
            })
            .Where(entry => entry.SuggestedTotal != 0 || invoicesByUnit.ContainsKey(entry.TerritoryId))
            .ToList();

        var cutDeals = cutsByUnit
            .SelectMany(kvp => kvp.Value.CutDeals.Select(deal => new CutDealEntryDto
            {
                TerritoryId = kvp.Key,
                TerritoryName = territoryNameById.GetValueOrDefault(kvp.Key, kvp.Key.ToString()),
                InvoiceNo = deal.InvoiceNo,
                DealValue = (double)deal.Value,
                Ratio = (double)deal.Ratio
            }))
            .ToList();

        // ข้อ 5.2 — REBALANCE opens only when every unit present in the region has a Target for
        // this period; never fall back to the other mode silently.
        if (mode == "REBALANCE" && missingByRegionName.Count > 0)
        {
            throw new RebalancePreconditionException(missingByRegionName);
        }

        return new TargetSuggestionPreviewDto
        {
            Year = year,
            Month = month,
            Mode = mode,
            Settings = new SuggestionSettingsDto
            {
                PotentialMetric = settings.PotentialMetric.ToString(),
                MinRegionCoverage = minRegionCoverage,
                TargetSuggestionAlpha = alpha,
                TargetLookbackMonths = settings.TargetLookbackMonths,
                TargetOutlierThreshold = threshold,
                TargetGrowthRate = growthRate
            },
            Window = new SuggestionWindowDto
            {
                Start = windowMonths.Count > 0 ? new YearMonthDto { Year = windowMonths[0].Year, Month = windowMonths[0].Month } : null,
                End = windowMonths.Count > 0 ? new YearMonthDto { Year = windowMonths[^1].Year, Month = windowMonths[^1].Month } : null,
                MonthsUsed = monthsUsed
            },
            Regions = regionResults,
            Unmapped = unmapped,
            Totals = totals,
            CutDeals = cutDeals
        };
    }
}
