namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class ImportIssue : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string ImportBatchId { get; set; } = string.Empty;
    public ImportBatch ImportBatch { get; set; } = null!;
    public string? SheetName { get; set; }
    public int? RowNumber { get; set; }
    public string? ColumnName { get; set; }
    public ImportIssueLevel Level { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? RawRow { get; set; }
}
