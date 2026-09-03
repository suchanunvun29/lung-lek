namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class SalesLineArchive : IDomainEntity
{
    public int Id { get; set; }
    public int SalesLineId { get; set; }
    public string RowKey { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Total { get; set; }
    public ArchiveReason Reason { get; set; }
    public int RemovedByBatchId { get; set; }
    public ImportBatch RemovedByBatch { get; set; } = null!;
    public DateTime RemovedAt { get; set; } = DateTime.UtcNow;
    public string Payload { get; set; } = string.Empty;
}
