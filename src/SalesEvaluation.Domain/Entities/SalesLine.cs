namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesLine : IDomainEntity
{
    public int Id { get; set; }
    public string InvoiceNo { get; set; } = string.Empty;
    public string? PoNo { get; set; }
    public DateOnly InvoiceDate { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;
    public int SalespersonId { get; set; }
    public Salesperson Salesperson { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int ProductTypeId { get; set; }
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
    public int ImportBatchId { get; set; }
    public ImportBatch ImportBatch { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesLineCredit> Credits { get; set; } = new List<SalesLineCredit>();
}
