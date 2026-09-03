namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalRegistryLink : IDomainEntity
{
    public int Id { get; set; }
    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;
    public int? HospitalRegistryId { get; set; }
    public HospitalRegistry? HospitalRegistry { get; set; }
    public RegistryLinkStatus Status { get; set; } = RegistryLinkStatus.UNREVIEWED;
    public RegistryLinkMethod? Method { get; set; }
    public decimal? Confidence { get; set; }
    public int? ReviewedById { get; set; }
    public User? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
