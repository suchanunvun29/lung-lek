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

/// <summary>
/// T-UX-027 — summary of an APPEND dry-run (confirm=false). Counts what the real import
/// WOULD do; nothing was persisted. IssueCounts counts issues per level (WARNING/ERROR).
/// </summary>
public record IssueLevelCount(string Level, int Count);

public record AppendPreview(
    int TotalRows,
    int InsertedRows,
    int UpdatedRows,
    int ErrorRows,
    List<IssueLevelCount> IssueCounts,
    List<Period> PeriodsFound,
    string? FatalError);

public record UnverifiedSalesmanDto(
    string RawName,
    string NormalizedKey,
    int RowCount,
    int? SuggestedSalespersonId,
    string? SuggestedSalespersonName);

public record SalesmanDryRunResult(
    int TotalRows,
    List<Period> PeriodsFound,
    List<UnverifiedSalesmanDto> UnverifiedSalesmen);

public record SalesmanDecisionInput(
    string NormalizedKey,
    string RawName,
    string Action, // "AUTO_CREATE", "MAP_EXISTING", "SKIP"
    int? TargetSalespersonId);

public record ImportResult(bool DryRun, ImportBatchDto? ImportBatch, DryRunPreview? Preview, AppendPreview? AppendPreview = null, SalesmanDryRunResult? SalesmanDryRun = null);

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
        int uploadedById,
        ImportMode mode,
        List<Period>? targetPeriods,
        bool confirm,
        List<SalesmanDecisionInput>? salesmanDecisions = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// POST /api/sales/import/dry-run — check salesperson names and return unverified salesmen.
    /// </summary>
    Task<SalesmanDryRunResult> DryRunSalesmanVerificationAsync(
        byte[] fileBuffer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// POST /import/period-delete — delete sales data for given periods, protected by advisory lock.
    /// </summary>
    Task<ImportResult> DeleteSalesPeriodsAsync(
        int uploadedById,
        List<Period> targetPeriods,
        bool confirm,
        CancellationToken cancellationToken = default);

    Task<List<ImportBatchDto>> ListImportBatchesAsync(CancellationToken cancellationToken = default);

    /// <summary>T-UX-025 — paged variant; total counts after status/q filters.</summary>
    Task<ImportBatchesPageDto> ListImportBatchesPageAsync(
        int page,
        int pageSize,
        string? status = null,
        string? q = null,
        CancellationToken cancellationToken = default);

    Task<ImportBatchDto?> GetImportBatchAsync(int id, CancellationToken cancellationToken = default);

    Task<SalesLinesPageDto> ListSalesLinesAsync(
        int? salespersonId,
        int? hospitalId,
        int? productTypeId,
        int? year,
        int? month,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public class ImportBatchDto
{
    public int Id { get; init; }
    public string FileName { get; init; } = string.Empty;
    public int FileSizeBytes { get; init; }
    public int UploadedById { get; init; }
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
    public int? ConfirmedById { get; init; }
    public List<ImportIssueDto>? Issues { get; init; }
}

public class UserRef
{
    public int Id { get; init; }
    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
}

public class ImportIssueDto
{
    public int Id { get; init; }
    public int ImportBatchId { get; init; }
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
    public int Id { get; init; }
    public string InvoiceNo { get; init; } = string.Empty;
    public string? PoNo { get; init; }
    public DateOnly InvoiceDate { get; init; }
    public int Year { get; init; }
    public int Month { get; init; }
    public int HospitalId { get; init; }
    public object? Hospital { get; init; }
    public int SalespersonId { get; init; }
    public object? Salesperson { get; init; }
    public int ProductId { get; init; }
    public object? Product { get; init; }
    public int ProductTypeId { get; init; }
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
    public int ImportBatchId { get; init; }
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

/// <summary>GET /import-batches?page=&pageSize= — T-UX-025; same shape as the other paginated lists.</summary>
public class ImportBatchesPageDto
{
    public List<ImportBatchDto> Items { get; init; } = new();
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
