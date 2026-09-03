namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class Region : IDomainEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Territory> Territories { get; set; } = new List<Territory>();
    public ICollection<ProvinceMapping> Provinces { get; set; } = new List<ProvinceMapping>();
    public ICollection<HospitalRegistry> RegistryHospitals { get; set; } = new List<HospitalRegistry>();
}
