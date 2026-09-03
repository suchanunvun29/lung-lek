namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class ProvinceMapping : IDomainEntity
{
    public int Id { get; set; }
    public string CanonicalName { get; set; } = string.Empty;
    public int RegionId { get; set; }
    public Region Region { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProvinceAlias> Aliases { get; set; } = new List<ProvinceAlias>();
    public ICollection<Hospital> Hospitals { get; set; } = new List<Hospital>();
    public ICollection<HospitalRegistry> RegistryHospitals { get; set; } = new List<HospitalRegistry>();
}
