namespace SalesEvaluation.Contracts.Hospitals;

public class HospitalTerritorySummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class HospitalAliasDto
{
    public int Id { get; set; }
    public string NormalizedKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public int HospitalId { get; set; }
    public string Source { get; set; } = string.Empty;
    public int? DecidedById { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class HospitalDto
{
    public int Id { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Province { get; set; }
    public bool IsPreExistingCustomer { get; set; }
    public int? TerritoryId { get; set; }
    public string TerritorySource { get; set; } = string.Empty;
    public int? ProvinceMappingId { get; set; }
    public HospitalTerritorySummaryDto? Territory { get; set; }
    public List<HospitalAliasDto> Aliases { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class HospitalsResponse
{
    public List<HospitalDto> Hospitals { get; set; } = new();
}

public class HospitalResponse
{
    public HospitalDto Hospital { get; set; } = null!;
}

public class UpdateHospitalRequest
{
    public bool? IsPreExistingCustomer { get; set; }
    public bool HasIsPreExistingCustomer { get; set; }
    public string? DisplayName { get; set; }
    public bool HasDisplayName { get; set; }
    public string? Province { get; set; }
    public bool HasProvince { get; set; }
}

public class CreateHospitalAliasRequest
{
    public string SampleRaw { get; set; } = string.Empty;
    public string? NormalizedKey { get; set; }
}

public class CreateHospitalAliasResponse
{
    public HospitalAliasDto HospitalAlias { get; set; } = null!;
}

public class PatchHospitalTerritoryRequest
{
    public int? TerritoryId { get; set; }
    public string? Note { get; set; }
}

public class BulkMoveHospitalsByProvinceRequest
{
    public string Province { get; set; } = string.Empty;
    public int? TerritoryId { get; set; }
    public string? Note { get; set; }
}

public class BulkMoveHospitalsResponse
{
    public int UpdatedCount { get; set; }
}

public class UnassignedTerritoryHospitalDto
{
    public int Id { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Province { get; set; }
    public bool IsPreExistingCustomer { get; set; }
    public int? TerritoryId { get; set; }
    public string TerritorySource { get; set; } = string.Empty;
    public int? ProvinceMappingId { get; set; }
    public decimal UnassignedBucket { get; set; }
    public bool Ambiguous { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UnassignedTerritoryHospitalsResponse
{
    public List<UnassignedTerritoryHospitalDto> Hospitals { get; set; } = new();
    public decimal UnassignedBucket { get; set; }
    public int HospitalCount { get; set; }
}
