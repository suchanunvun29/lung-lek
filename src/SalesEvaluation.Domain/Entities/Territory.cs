namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class Territory : IDomainEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? RegionId { get; set; }
    public Region? Region { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TerritoryAssignment> Assignments { get; set; } = new List<TerritoryAssignment>();
    public ICollection<Hospital> Hospitals { get; set; } = new List<Hospital>();
    public ICollection<Target> Targets { get; set; } = new List<Target>();
    public ICollection<TerritoryGroupMember> GroupMemberships { get; set; } = new List<TerritoryGroupMember>();
    public ICollection<HospitalRegistry> RegistryHospitals { get; set; } = new List<HospitalRegistry>();
}
