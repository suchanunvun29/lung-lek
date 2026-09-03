namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class SalesmanNameReview : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string PersonKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public NameReviewStatus Status { get; set; } = NameReviewStatus.PENDING;
    public string? CreatedSalespersonId { get; set; }
    public Salesperson? CreatedSalesperson { get; set; }
    public string? MergedIntoId { get; set; }
    public Salesperson? MergedInto { get; set; }
    public string? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
