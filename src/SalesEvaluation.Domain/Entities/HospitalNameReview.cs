namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalNameReview : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedKeyA { get; set; } = string.Empty;
    public string NormalizedKeyB { get; set; } = string.Empty;
    public string SampleRawA { get; set; } = string.Empty;
    public string SampleRawB { get; set; } = string.Empty;
    public decimal? Similarity { get; set; }
    public NameReviewStatus Status { get; set; } = NameReviewStatus.PENDING;
    public string? MergedIntoId { get; set; }
    public Hospital? MergedInto { get; set; }
    public string? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
