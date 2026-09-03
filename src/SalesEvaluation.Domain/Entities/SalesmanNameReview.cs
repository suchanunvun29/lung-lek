namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class SalesmanNameReview : IDomainEntity
{
    public int Id { get; set; }
    public string PersonKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public NameReviewStatus Status { get; set; } = NameReviewStatus.PENDING;
    public int? CreatedSalespersonId { get; set; }
    public Salesperson? CreatedSalesperson { get; set; }
    public int? MergedIntoId { get; set; }
    public Salesperson? MergedInto { get; set; }
    public int? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
