namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class SalesLineArchive : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string SalesLineId { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Total { get; set; }
    public ArchiveReason Reason { get; set; }
    public string RemovedByBatchId { get; set; } = string.Empty;
    public ImportBatch RemovedByBatch { get; set; } = null!;
    public DateTime RemovedAt { get; set; } = DateTime.UtcNow;
    public string Payload { get; set; } = string.Empty;
}
