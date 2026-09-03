namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class ImportBatch : IDomainEntity
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int FileSizeBytes { get; set; }
    public int UploadedById { get; set; }
    public User UploadedBy { get; set; } = null!;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public ImportStatus Status { get; set; } = ImportStatus.PROCESSING;
    public string? SheetsFound { get; set; }
    public string? SheetsImported { get; set; }
    public int TotalRows { get; set; } = 0;
    public int InsertedRows { get; set; } = 0;
    public int UpdatedRows { get; set; } = 0;
    public int SkippedRows { get; set; } = 0;
    public int ErrorRows { get; set; } = 0;
    public string? PeriodsTouched { get; set; }
    public string? ErrorMessage { get; set; }
    public ImportMode Mode { get; set; } = ImportMode.APPEND;
    public string? TargetPeriods { get; set; }
    public int RemovedRows { get; set; } = 0;
    public int? ConfirmedById { get; set; }

    public ICollection<SalesLine> SalesLines { get; set; } = new List<SalesLine>();
    public ICollection<ImportIssue> Issues { get; set; } = new List<ImportIssue>();
    public ICollection<SalesLineArchive> ArchivedLines { get; set; } = new List<SalesLineArchive>();
}
