namespace SalesEvaluation.Contracts.HospitalRegistry;

using SalesEvaluation.Contracts.Territories;

public class RegionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProvinceMappingDto
{
    public string Id { get; set; } = string.Empty;
    public string CanonicalName { get; set; } = string.Empty;
    public string RegionId { get; set; } = string.Empty;
    public RegionDto Region { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}

public class ProvincesResponse
{
    public List<ProvinceMappingDto> Provinces { get; set; } = new();
    public List<RegionDto> Regions { get; set; } = new();
}

/// <summary>PATCH /provinces/{id} body — provide canonicalName or regionId.</summary>
public class UpdateProvinceRequest
{
    public string? CanonicalName { get; set; }
    public bool HasCanonicalName { get; set; }
    public string? RegionId { get; set; }
    public bool HasRegionId { get; set; }

    public bool HasAnyField => HasCanonicalName || HasRegionId;
}

public class ProvinceResponse
{
    public ProvinceMappingDto Province { get; set; } = null!;
}

/// <summary>Raw Territory row — Prisma `territory: true` include (display field is `name`).</summary>
public class TerritoryRecordDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? RegionId { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class HospitalRegistryMetricDto
{
    public string Id { get; set; } = string.Empty;
    public string HospitalRegistryId { get; set; } = string.Empty;
    public string Metric { get; set; } = string.Empty;
    /// <summary>Prisma Decimal — serialized as a JSON string per the frontend contract.</summary>
    public string Value { get; set; } = string.Empty;
    public int? PeriodYear { get; set; }
    public int? PeriodMonth { get; set; }
    public string? SourceFile { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>HospitalRegistry row as returned by GET /hospital-registries (provinceMapping incl. region, territory, metrics).</summary>
public class HospitalRegistryDto
{
    public string Id { get; set; } = string.Empty;
    public string? SourceCode { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? ProvinceMappingId { get; set; }
    public ProvinceMappingDto? ProvinceMapping { get; set; }
    public string ProvinceRaw { get; set; } = string.Empty;
    public string? RegionId { get; set; }
    public RegionDto? Region { get; set; }
    public string? HealthZone { get; set; }
    public string? Tier { get; set; }
    public string Category { get; set; } = string.Empty;
    /// <summary>Prisma Decimal — serialized as a JSON string per the frontend contract.</summary>
    public string PotentialAdjustment { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? SourceFile { get; set; }
    public string? TerritoryId { get; set; }
    public TerritoryRecordDto? Territory { get; set; }
    public string TerritorySource { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<HospitalRegistryMetricDto> Metrics { get; set; } = new();
}

public class HospitalRegistriesResponse
{
    public List<HospitalRegistryDto> HospitalRegistries { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

/// <summary>PATCH /hospital-registry/{id}/potential-adjustment response shape (requirement 10.5).</summary>
public class PotentialAdjustmentDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Tier { get; set; }
    public string PotentialAdjustment { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class PotentialAdjustmentResponse
{
    public PotentialAdjustmentDto HospitalRegistry { get; set; } = null!;
}

public class LinkHospitalDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Province { get; set; }
    public ProvinceMappingDto? ProvinceMapping { get; set; }
}

public class HospitalRegistryLinkDto
{
    public string Id { get; set; } = string.Empty;
    public string HospitalId { get; set; } = string.Empty;
    public string? HospitalRegistryId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Method { get; set; }
    /// <summary>Prisma Decimal — serialized as a JSON string per the frontend contract.</summary>
    public string? Confidence { get; set; }
    public string? ReviewedById { get; set; }
    public UserSummaryDto? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public LinkHospitalDto Hospital { get; set; } = null!;
    public HospitalRegistryDto? HospitalRegistry { get; set; }
}

public class HospitalRegistryLinksResponse
{
    public List<HospitalRegistryLinkDto> HospitalRegistryLinks { get; set; } = new();
}

public class HospitalRegistryLinkResponse
{
    public HospitalRegistryLinkDto HospitalRegistryLink { get; set; } = null!;
}

/// <summary>
/// PATCH /hospital-registry-links/{hospitalId} body — status LINKED requires hospitalRegistryId;
/// status CONFIRMED_ABSENT requires hospitalRegistryId to be null.
/// </summary>
public class UpdateRegistryLinkRequest
{
    public string Status { get; set; } = string.Empty;
    public string? HospitalRegistryId { get; set; }
    public bool HasHospitalRegistryId { get; set; }
    public string? Note { get; set; }
    public bool HasNote { get; set; }
}

public class TierWeightDto
{
    public string Tier { get; set; } = string.Empty;
    /// <summary>Prisma Decimal — serialized as a JSON string per the frontend contract.</summary>
    public string Weight { get; set; } = string.Empty;
    public bool IsCustom { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class TierWeightsResponse
{
    public List<TierWeightDto> Weights { get; set; } = new();
}
