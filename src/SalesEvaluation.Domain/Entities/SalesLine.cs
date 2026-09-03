namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesLine : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string InvoiceNo { get; set; } = string.Empty;
    public string? PoNo { get; set; }
    public DateOnly InvoiceDate { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string HospitalId { get; set; } = string.Empty;
    public Hospital Hospital { get; set; } = null!;
    public string SalespersonId { get; set; } = string.Empty;
    public Salesperson Salesperson { get; set; } = null!;
    public string ProductId { get; set; } = string.Empty;
    public Product Product { get; set; } = null!;
    public string ProductTypeId { get; set; } = string.Empty;
    public ProductType ProductType { get; set; } = null!;
    public string? Lot { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? Province { get; set; }
    public decimal Qty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal Vat { get; set; }
    public decimal Total { get; set; }
    public string RowKey { get; set; } = string.Empty;
    public string SourceSheetName { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public string ImportBatchId { get; set; } = string.Empty;
    public ImportBatch ImportBatch { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesLineCredit> Credits { get; set; } = new List<SalesLineCredit>();
}
