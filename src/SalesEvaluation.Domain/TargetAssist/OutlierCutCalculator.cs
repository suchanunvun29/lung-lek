namespace SalesEvaluation.Domain.TargetAssist;

using System.Collections.Generic;

public sealed class UnitInvoice
{
    public required string InvoiceNo { get; init; }
    public required decimal Total { get; init; }
    public required Dictionary<int, decimal> ByRegion { get; init; }
    public required decimal Unmapped { get; init; }
}

public sealed class OutlierCutResult
{
    public required Dictionary<int, decimal> BeforeByRegion { get; set; }
    public required decimal BeforeUnmapped { get; set; }
    public required Dictionary<int, decimal> AfterByRegion { get; set; }
    public required decimal AfterUnmapped { get; set; }
    public required List<CutDeal> CutDeals { get; set; }
}

public sealed class CutDeal
{
    public required string InvoiceNo { get; init; }
    public required decimal Value { get; init; }
    public required decimal Ratio { get; init; }
}

public static class OutlierCutCalculator
{
    public static OutlierCutResult ApplyOutlierCut(
        IEnumerable<UnitInvoice> invoices,
        decimal threshold,
        IReadOnlySet<string> reinstatedInvoiceNos)
    {
        var result = new OutlierCutResult
        {
            BeforeByRegion = new Dictionary<int, decimal>(),
            BeforeUnmapped = 0m,
            AfterByRegion = new Dictionary<int, decimal>(),
            AfterUnmapped = 0m,
            CutDeals = new List<CutDeal>()
        };

        var invoiceList = invoices.ToList();
        var grandTotal = invoiceList.Sum(i => i.Total);

        foreach (var invoice in invoiceList)
        {
            var ratio = grandTotal > 0 ? invoice.Total / grandTotal : 0m;
            var isOutlier = !reinstatedInvoiceNos.Contains(invoice.InvoiceNo) && ratio > threshold;

            foreach (var (regionId, value) in invoice.ByRegion)
            {
                result.BeforeByRegion[regionId] = result.BeforeByRegion.GetValueOrDefault(regionId) + value;
                if (!isOutlier)
                {
                    result.AfterByRegion[regionId] = result.AfterByRegion.GetValueOrDefault(regionId) + value;
                }
            }

            result.BeforeUnmapped += invoice.Unmapped;
            if (!isOutlier)
            {
                result.AfterUnmapped += invoice.Unmapped;
            }

            if (isOutlier)
            {
                result.CutDeals.Add(new CutDeal
                {
                    InvoiceNo = invoice.InvoiceNo,
                    Value = invoice.Total,
                    Ratio = ratio
                });
            }
        }

        return result;
    }
}