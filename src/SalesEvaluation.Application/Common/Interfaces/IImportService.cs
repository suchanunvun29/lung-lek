namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Domain.Enums;

public record Period(int Year, int Month);

public record DryRunPreview(
    List<Period> TargetPeriods,
    int ExistingRows,
    string ExistingTotal,
    int InsertedRows,
    int UpdatedRows,
    int RemovedRows,
    List<RemovalSample> RemovalSamples,
    bool WillDeletePeriodWithoutReplacement);

public record RemovalSample(string InvoiceNo, string HospitalName, string Total);

public record ImportResult(bool DryRun, ImportBatchDto? ImportBatch, DryRunPreview? Preview);

public interface IImportService
{
    /// <summary>
    /// POST /import — parse .xlsx, upsert SalesLines, lock via pg_try_advisory_xact_lock(872341987).
    /// Returns ImportResult: either a completed ImportBatch or a DryRunPreview (confirm=false).
    /// </summary>
    Task<ImportResult> ImportSalesFileAsync(
        byte[] fileBuffer,
        string fileName,
        int fileSizeBytes,
        string uploadedById,
        ImportMode mode,
        List<Period>? targetPeriods,
        bool confirm,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// POST /import/period-delete — delete sales data for given periods, protected by advisory lock.
    /// </summary>
    Task<ImportResult> DeleteSalesPeriodsAsync(
        string uploadedById,
        List<Period> targetPeriods,
        bool confirm,
        CancellationToken cancellationToken = default);

    Task<List<ImportBatchDto>> ListImportBatchesAsync(CancellationToken cancellationToken = default);

    Task<ImportBatchDto?> GetImportBatchAsync(string id, CancellationToken cancellationToken = default);

    Task<SalesLinesPageDto> ListSalesLinesAsync(
        string? salespersonId,
        string? hospitalId,
        string? productTypeId,
        int? year,
        int? month,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public class ImportBatchDto
{
    public string Id { get; init; } = string.Empty;
    public string FileName { get; init; } = string.Empty;
    public int FileSizeBytes { get; init; }
    public string UploadedById { get; init; } = string.Empty;
    public UserRef? UploadedBy { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime? FinishedAt { get; init; }
    public string Status { get; init; } = string.Empty;
    public object? SheetsFound { get; init; }
    public object? SheetsImported { get; init; }
    public int TotalRows { get; init; }
    public int InsertedRows { get; init; }
    public int UpdatedRows { get; init; }
    public int SkippedRows { get; init; }
    public int ErrorRows { get; init; }
    public object? PeriodsTouched { get; init; }
    public string? ErrorMessage { get; init; }
    public string Mode { get; init; } = string.Empty;
    public object? TargetPeriods { get; init; }
    public int RemovedRows { get; init; }
    public string? ConfirmedById { get; init; }
    public List<ImportIssueDto>? Issues { get; init; }
}

public class UserRef
{
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
}

public class ImportIssueDto
{
    public string Id { get; init; } = string.Empty;
    public string ImportBatchId { get; init; } = string.Empty;
    public string? SheetName { get; init; }
    public int? RowNumber { get; init; }
    public string? ColumnName { get; init; }
    public string Level { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? RawRow { get; init; }
}

public class SalesLineDto
{
    public string Id { get; init; } = string.Empty;
    public string InvoiceNo { get; init; } = string.Empty;
    public string? PoNo { get; init; }
    public DateOnly InvoiceDate { get; init; }
    public int Year { get; init; }
    public int Month { get; init; }
    public string HospitalId { get; init; } = string.Empty;
    public object? Hospital { get; init; }
    public string SalespersonId { get; init; } = string.Empty;
    public object? Salesperson { get; init; }
    public string ProductId { get; init; } = string.Empty;
    public object? Product { get; init; }
    public string ProductTypeId { get; init; } = string.Empty;
    public object? ProductType { get; init; }
    public string? Lot { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public string? Province { get; init; }
    public decimal Qty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal Amount { get; init; }
    public decimal Vat { get; init; }
    public decimal Total { get; init; }
    public string RowKey { get; init; } = string.Empty;
    public string SourceSheetName { get; init; } = string.Empty;
    public int SourceRowNumber { get; init; }
    public string ImportBatchId { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public class SalesLinesPageDto
{
    public List<SalesLineDto> Data { get; init; } = new();
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
