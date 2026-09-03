namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.TerritoryViews;
using SalesEvaluation.Domain.Enums;

public class TerritoryViewPeriod
{
    public PeriodType PeriodType { get; init; }
    public int Year { get; init; }
    public int PeriodNumber { get; init; }
}

public class TerritoryViewQuery
{
    public TerritoryViewPeriod Period { get; init; } = new();
    public string? ProductTypeId { get; init; }
    public bool CreditOnly { get; init; }
}

public class NeverSoldQuery
{
    public TerritoryViewPeriod Period { get; init; } = new();
    public int TopN { get; init; } = 20;
    public string? ProvinceMappingId { get; init; }
    public PotentialMetricKey PotentialMetric { get; init; } = PotentialMetricKey.BEDS;
    public string? ProductTypeId { get; init; }
}

/// <summary>
/// Salesperson territory view (Module P1) and never-sold government hospitals (Module P2),
/// mirroring backend/src/services/territoryView.service.ts. Territory membership is per viewed
/// period and every amount reads through SalesLineCredit (revenue ข้อ-2 math).
/// Returns null when the salesperson does not exist (caller maps to 404).
/// </summary>
public interface ITerritoryViewService
{
    Task<MyTerritoryViewResponse?> GetTerritoryViewAsync(string salespersonId, TerritoryViewQuery query, CancellationToken cancellationToken = default);

    Task<NeverSoldHospitalsResponse?> GetNeverSoldHospitalsAsync(string salespersonId, NeverSoldQuery query, CancellationToken cancellationToken = default);
}
