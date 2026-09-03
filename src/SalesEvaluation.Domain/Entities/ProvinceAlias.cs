namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class ProvinceAlias : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedAlias { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string ProvinceMappingId { get; set; } = string.Empty;
    public ProvinceMapping ProvinceMapping { get; set; } = null!;
    public bool IsDistrictLevel { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
