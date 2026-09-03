namespace SalesEvaluation.Contracts.TerritoryViews;

public class EntitySummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class SoldHospitalDto
{
    public EntitySummaryDto Hospital { get; set; } = null!;
    public decimal Revenue { get; set; }
}

public class SoldBeforeHospitalDto
{
    public SoldBeforeHospitalNameDto Hospital { get; set; } = null!;
}

public class SoldBeforeHospitalNameDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Province { get; set; }
}

/// <summary>
/// GET /my-territory-view/{salespersonId} — the `period` property echoes the raw query
/// parameters that were sent (string values, only the ones present), matching Express `req.query`.
/// </summary>
public class MyTerritoryViewResponse
{
    public Dictionary<string, string> Period { get; set; } = new();
    public EntitySummaryDto Salesperson { get; set; } = null!;
    public List<EntitySummaryDto> Territories { get; set; } = new();
    public string Mode { get; set; } = string.Empty;
    public bool CreditOnly { get; set; }
    public string? ProductTypeId { get; set; }
    public List<SoldHospitalDto> SoldHospitals { get; set; } = new();
    public List<SoldBeforeHospitalDto> SoldBeforeButNotInPeriod { get; set; } = new();
}

public class NeverSoldHospitalItemDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string? ProvinceMappingId { get; set; }
    public string? Tier { get; set; }
    public string Category { get; set; } = string.Empty;
    public string MetricKey { get; set; } = string.Empty;
    public decimal MetricValue { get; set; }
    public EntitySummaryDto? Territory { get; set; }
}

public class NeverSoldHospitalsResponse
{
    public Dictionary<string, string> Period { get; set; } = new();
    public EntitySummaryDto Salesperson { get; set; } = null!;
    public List<EntitySummaryDto> Territories { get; set; } = new();
    public string Mode { get; set; } = string.Empty;
    public string PotentialMetric { get; set; } = string.Empty;
    public int TopN { get; set; }
    public string? ProvinceMappingId { get; set; }
    public string? ProductTypeId { get; set; }
    public int TotalNeverSold { get; set; }
    public List<NeverSoldHospitalItemDto> NeverSoldHospitals { get; set; } = new();
}
