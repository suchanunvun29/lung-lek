namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class Salesperson : IDomainEntity
{
    public int Id { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int? UserId { get; set; }
    public User? User { get; set; }
    public bool ExcludedFromTerritoryTotals { get; set; } = false;
    public DateOnly? EmploymentEndedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesLine> SalesLines { get; set; } = new List<SalesLine>();
    public ICollection<Target> Targets { get; set; } = new List<Target>();
    public ICollection<CoachingInsight> Insights { get; set; } = new List<CoachingInsight>();
    public ICollection<SalesLineCredit> Credits { get; set; } = new List<SalesLineCredit>();
    public ICollection<SalesmanNameRuleMember> NameRuleMemberships { get; set; } = new List<SalesmanNameRuleMember>();
    public ICollection<TerritoryAssignment> TerritoryAssignments { get; set; } = new List<TerritoryAssignment>();
    public ICollection<SalesmanNameReview> NameReviewsCreated { get; set; } = new List<SalesmanNameReview>();
    public ICollection<SalesmanNameReview> NameReviewsMergedInto { get; set; } = new List<SalesmanNameReview>();
}
