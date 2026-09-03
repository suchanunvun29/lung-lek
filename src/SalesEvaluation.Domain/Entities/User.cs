namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class User : IDomainEntity
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Salesperson? Salesperson { get; set; }
    public ICollection<ImportBatch> ImportBatches { get; set; } = new List<ImportBatch>();
    public ICollection<TargetRevision> TargetRevisions { get; set; } = new List<TargetRevision>();
    public ICollection<ScoringWeightRevision> WeightRevisions { get; set; } = new List<ScoringWeightRevision>();
    public ICollection<EvaluationSetting> SettingUpdates { get; set; } = new List<EvaluationSetting>();
    public ICollection<CoachingInsight> GeneratedInsights { get; set; } = new List<CoachingInsight>();
    public ICollection<SalesmanNameRule> SalesmanNameRules { get; set; } = new List<SalesmanNameRule>();
    public ICollection<HospitalAlias> HospitalAliases { get; set; } = new List<HospitalAlias>();
    public ICollection<HospitalNameReview> HospitalNameReviews { get; set; } = new List<HospitalNameReview>();
    public ICollection<SalesmanNameReview> SalesmanNameReviews { get; set; } = new List<SalesmanNameReview>();
    public ICollection<HospitalRegistryLink> RegistryLinkReviews { get; set; } = new List<HospitalRegistryLink>();
    public ICollection<ProductAlias> ProductAliases { get; set; } = new List<ProductAlias>();
    public ICollection<TerritoryAssignment> TerritoryAssignmentsMade { get; set; } = new List<TerritoryAssignment>();
}
