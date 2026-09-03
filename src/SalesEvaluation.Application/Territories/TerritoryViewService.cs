namespace SalesEvaluation.Application.Territories;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.TerritoryViews;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class TerritoryViewService : ITerritoryViewService
{
    private static readonly StringComparer ThaiNameComparer = StringComparer.Create(new CultureInfo("th-TH"), ignoreCase: false);

    private readonly IAppDbContext _dbContext;

    public TerritoryViewService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // ---- Shared period helpers (mirrors services/period.util.ts) ----

    internal static List<(int Year, int Month)> MonthsInPeriod(TerritoryViewPeriod period)
    {
        if (period.PeriodType == PeriodType.QUARTER)
        {
            var startMonth = (period.PeriodNumber - 1) * 3 + 1;
            return new List<(int, int)> { (period.Year, startMonth), (period.Year, startMonth + 1), (period.Year, startMonth + 2) };
        }

        if (period.PeriodType == PeriodType.YEAR)
        {
            return Enumerable.Range(1, 12).Select(m => (period.Year, m)).ToList();
        }

        return new List<(int, int)> { (period.Year, period.PeriodNumber) };
    }

    private static DateOnly FirstDayOfPeriod(TerritoryViewPeriod period)
    {
        var first = MonthsInPeriod(period)[0];
        return new DateOnly(first.Year, first.Month, 1);
    }

    private static DateOnly LastDayOfPeriod(TerritoryViewPeriod period)
    {
        var months = MonthsInPeriod(period);
        var last = months[^1];
        return new DateOnly(last.Year, last.Month, DateTime.DaysInMonth(last.Year, last.Month));
    }

    /// <summary>SalesLine (year, month) filter as a translatable month key.</summary>
    private static int MonthKey(int year, int month) => year * 12 + (month - 1);

    // ---- Module P1: territory view ----

    public async Task<MyTerritoryViewResponse?> GetTerritoryViewAsync(string salespersonId, TerritoryViewQuery query, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);

        if (salesperson == null)
        {
            return null;
        }

        var months = MonthsInPeriod(query.Period);
        var monthKeys = months.Select(m => MonthKey(m.Year, m.Month)).ToList();

        // Module P1 (Territory KPI Rules ข้อ 8): territories come from assignments effective in
        // the viewed period (midnight-to-midnight comparison, so the boundary days are inclusive).
        var firstDay = FirstDayOfPeriod(query.Period);
        var lastDay = LastDayOfPeriod(query.Period);

        var assignments = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Territory)
            .Where(a => a.SalespersonId == salespersonId && a.EffectiveFrom <= lastDay && (a.EffectiveTo == null || a.EffectiveTo >= firstDay))
            .ToListAsync(cancellationToken);

        var territoryIds = assignments.Select(a => a.TerritoryId).ToList();

        var fallback = salesperson.ExcludedFromTerritoryTotals || territoryIds.Count == 0;
        var ownCreditsOnly = fallback || query.CreditOnly;

        var currentIds = await HospitalIdsWithCreditedSalesAsync(ownCreditsOnly, salespersonId, territoryIds, fallback, query.ProductTypeId, monthKeys, cancellationToken);
        var everIds = await HospitalIdsWithCreditedSalesAsync(ownCreditsOnly, salespersonId, territoryIds, fallback, query.ProductTypeId, monthKeys: null, cancellationToken);
        var currentRevenue = await CreditedRevenueByHospitalAsync(ownCreditsOnly, salespersonId, territoryIds, fallback, query.ProductTypeId, monthKeys, cancellationToken);

        var unionIds = currentIds.Union(everIds).ToList();
        var hospitals = await _dbContext.Hospitals
            .AsNoTracking()
            .Where(h => unionIds.Contains(h.Id))
            .Select(h => new { h.Id, h.DisplayName, h.Province })
            .ToDictionaryAsync(h => h.Id, cancellationToken);

        var soldHospitals = currentIds
            .Where(id => hospitals.ContainsKey(id))
            .Select(id => new SoldHospitalDto
            {
                Hospital = new EntitySummaryDto { Id = id, DisplayName = hospitals[id].DisplayName },
                Revenue = currentRevenue.GetValueOrDefault(id)
            })
            .OrderByDescending(row => row.Revenue)
            .ToList();

        var soldBeforeButNotInPeriod = everIds
            .Except(currentIds)
            .Where(id => hospitals.ContainsKey(id))
            .Select(id => new SoldBeforeHospitalDto
            {
                Hospital = new SoldBeforeHospitalNameDto
                {
                    Id = id,
                    DisplayName = hospitals[id].DisplayName,
                    Province = hospitals[id].Province
                }
            })
            .OrderBy(row => row.Hospital.DisplayName, ThaiNameComparer)
            .ToList();

        return new MyTerritoryViewResponse
        {
            Salesperson = new EntitySummaryDto { Id = salesperson.Id, DisplayName = salesperson.DisplayName },
            Territories = assignments.Select(a => new EntitySummaryDto { Id = a.Territory.Id, DisplayName = a.Territory.Name }).ToList(),
            Mode = fallback
                ? "NATIONWIDE_PRODUCT_TYPE_FALLBACK"
                : query.CreditOnly
                    ? "OWN_CREDIT_ONLY"
                    : "TERRITORY_TOTAL",
            CreditOnly = query.CreditOnly,
            ProductTypeId = query.ProductTypeId,
            SoldHospitals = soldHospitals,
            SoldBeforeButNotInPeriod = soldBeforeButNotInPeriod
        };
    }

    // ---- Module P2: never-sold government hospitals ----

    public async Task<NeverSoldHospitalsResponse?> GetNeverSoldHospitalsAsync(string salespersonId, NeverSoldQuery query, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);

        if (salesperson == null)
        {
            return null;
        }

        var firstDay = FirstDayOfPeriod(query.Period);
        var lastDay = LastDayOfPeriod(query.Period);

        var assignments = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Territory)
            .Where(a => a.SalespersonId == salespersonId && a.EffectiveFrom <= lastDay && (a.EffectiveTo == null || a.EffectiveTo >= firstDay))
            .ToListAsync(cancellationToken);

        var territoryIds = assignments.Select(a => a.TerritoryId).ToList();
        var fallback = salesperson.ExcludedFromTerritoryTotals || territoryIds.Count == 0;

        // hospitalId ทั้งหมดที่มีประวัติการขาย (ถ้ามี productTypeId ให้กรองเฉพาะกลุ่มสินค้านั้น)
        var soldLinesQuery = _dbContext.SalesLines.AsNoTracking();
        if (!string.IsNullOrEmpty(query.ProductTypeId))
        {
            soldLinesQuery = soldLinesQuery.Where(sl => sl.ProductTypeId == query.ProductTypeId);
        }

        var soldHospitalIds = await soldLinesQuery
            .Select(sl => sl.HospitalId)
            .Distinct()
            .ToListAsync(cancellationToken);

        // hospitalRegistryId ที่ผูกกับโรงพยาบาลที่เคยขาย
        var soldRegistryIds = (await _dbContext.HospitalRegistryLinks
                .AsNoTracking()
                .Where(l => soldHospitalIds.Contains(l.HospitalId) && l.Status == RegistryLinkStatus.LINKED && l.HospitalRegistryId != null)
                .Select(l => l.HospitalRegistryId!)
                .ToListAsync(cancellationToken))
            .ToHashSet();

        // โรงพยาบาลรัฐทั่วไปในทะเบียนที่ยังไม่เคยมีรายการขาย
        var registriesQuery = _dbContext.HospitalRegistries
            .AsNoTracking()
            .Include(r => r.ProvinceMapping)
            .Include(r => r.Territory)
            .Include(r => r.Metrics.Where(m => m.Metric == query.PotentialMetric).OrderByDescending(m => m.CreatedAt).Take(1))
            .Where(r => r.Category == HospitalCategory.GOVERNMENT_GENERAL &&
                        r.IsActive &&
                        !soldRegistryIds.Contains(r.Id));

        if (!fallback)
        {
            registriesQuery = registriesQuery.Where(r => r.TerritoryId != null && territoryIds.Contains(r.TerritoryId));
        }

        if (!string.IsNullOrEmpty(query.ProvinceMappingId))
        {
            registriesQuery = registriesQuery.Where(r => r.ProvinceMappingId == query.ProvinceMappingId);
        }

        var registries = await registriesQuery.ToListAsync(cancellationToken);

        var formatted = registries.Select(r =>
        {
            var metricValue = r.Metrics.FirstOrDefault()?.Value ?? 0m;
            return new NeverSoldHospitalItemDto
            {
                Id = r.Id,
                DisplayName = r.DisplayName,
                Province = r.ProvinceMapping?.CanonicalName ?? r.ProvinceRaw,
                ProvinceMappingId = r.ProvinceMappingId,
                Tier = r.Tier,
                Category = r.Category.ToString(),
                MetricKey = query.PotentialMetric.ToString(),
                MetricValue = metricValue,
                Territory = r.Territory == null ? null : new EntitySummaryDto { Id = r.Territory.Id, DisplayName = r.Territory.Name }
            };
        })
        .OrderByDescending(item => item.MetricValue)
        .ThenBy(item => item.DisplayName, ThaiNameComparer)
        .ToList();

        return new NeverSoldHospitalsResponse
        {
            Salesperson = new EntitySummaryDto { Id = salesperson.Id, DisplayName = salesperson.DisplayName },
            Territories = assignments.Select(a => new EntitySummaryDto { Id = a.Territory.Id, DisplayName = a.Territory.Name }).ToList(),
            Mode = fallback ? "NATIONWIDE_PRODUCT_TYPE_FALLBACK" : "TERRITORY_TOTAL",
            PotentialMetric = query.PotentialMetric.ToString(),
            TopN = query.TopN,
            ProvinceMappingId = query.ProvinceMappingId,
            ProductTypeId = query.ProductTypeId,
            TotalNeverSold = formatted.Count,
            NeverSoldHospitals = formatted.Take(query.TopN).ToList()
        };
    }

    // ---- Shared credited-sales helpers (mirrors kpi.service.ts's single-source definitions) ----

    /// <summary>
    /// "Has credited sales" is contract-defined through SalesLineCredit so excluded personnel never
    /// count as territory sales. In own-credit mode only this person's shares count.
    /// </summary>
    private async Task<HashSet<string>> HospitalIdsWithCreditedSalesAsync(bool ownCreditsOnly, string salespersonId, List<string> territoryIds, bool fallback, string? productTypeId, List<int>? monthKeys, CancellationToken cancellationToken)
    {
        var query = CreditedSalesQuery(ownCreditsOnly, salespersonId, territoryIds, fallback, productTypeId, monthKeys);
        var ids = await query.Select(c => c.SalesLine.HospitalId).Distinct().ToListAsync(cancellationToken);
        return new HashSet<string>(ids);
    }

    private async Task<Dictionary<string, decimal>> CreditedRevenueByHospitalAsync(bool ownCreditsOnly, string salespersonId, List<string> territoryIds, bool fallback, string? productTypeId, List<int>? monthKeys, CancellationToken cancellationToken)
    {
        var rows = await CreditedSalesQuery(ownCreditsOnly, salespersonId, territoryIds, fallback, productTypeId, monthKeys)
            .Select(c => new { HospitalId = c.SalesLine.HospitalId, Total = c.SalesLine.Total, c.SharePercent })
            .ToListAsync(cancellationToken);

        var totals = new Dictionary<string, decimal>();
        foreach (var row in rows)
        {
            totals[row.HospitalId] = totals.GetValueOrDefault(row.HospitalId) + row.Total * (row.SharePercent / 100m);
        }

        return totals;
    }

    private IQueryable<SalesLineCredit> CreditedSalesQuery(bool ownCreditsOnly, string salespersonId, List<string> territoryIds, bool fallback, string? productTypeId, List<int>? monthKeys)
    {
        var query = _dbContext.SalesLineCredits.AsNoTracking().AsQueryable();

        if (ownCreditsOnly)
        {
            query = query.Where(c => c.SalespersonId == salespersonId);
        }
        else
        {
            query = query.Where(c => !c.Salesperson.ExcludedFromTerritoryTotals);
        }

        if (!fallback)
        {
            query = query.Where(c => c.SalesLine.Hospital != null && territoryIds.Contains(c.SalesLine.Hospital.TerritoryId!));
        }

        if (!string.IsNullOrEmpty(productTypeId))
        {
            query = query.Where(c => c.SalesLine.ProductTypeId == productTypeId);
        }

        if (monthKeys != null)
        {
            query = query.Where(c => monthKeys.Contains(c.SalesLine.Year * 12 + c.SalesLine.Month - 1));
        }

        return query;
    }
}
