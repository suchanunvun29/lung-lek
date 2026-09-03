namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.TargetAssist;
using Xunit;

public class OutlierCutCalculatorTests
{
    private static UnitInvoice CreateInvoice(string invoiceNo, decimal total, Dictionary<string, decimal> byRegion, decimal unmapped)
        => new UnitInvoice
        {
            InvoiceNo = invoiceNo,
            Total = total,
            ByRegion = byRegion,
            Unmapped = unmapped
        };

    [Fact]
    public void ApplyOutlierCut_NoOutliers_ReturnsAllInvoices()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 100m, new Dictionary<string, decimal> { { "R1", 50m }, { "R2", 50m } }, 0m),
            CreateInvoice("INV-2", 100m, new Dictionary<string, decimal> { { "R1", 100m } }, 0m),
        };

        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        Assert.Equal(200m, result.BeforeByRegion.Values.Sum());
        Assert.Equal(200m, result.AfterByRegion.Values.Sum());
        Assert.Empty(result.CutDeals);
    }

    [Fact]
    public void ApplyOutlierCut_CutsOutlierInvoice()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 1000m, new Dictionary<string, decimal> { { "R1", 1000m } }, 0m),
            CreateInvoice("INV-2", 100m, new Dictionary<string, decimal> { { "R1", 100m } }, 0m),
        };

        // INV-1 is 1000/1100 = 90.9% > 50% threshold
        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        Assert.Equal(1100m, result.BeforeByRegion["R1"]);
        Assert.Equal(100m, result.AfterByRegion["R1"]);
        Assert.Single(result.CutDeals);
        Assert.Equal("INV-1", result.CutDeals[0].InvoiceNo);
        Assert.Equal(1000m, result.CutDeals[0].Value);
        Assert.Equal(1000m / 1100m, result.CutDeals[0].Ratio);
    }

    [Fact]
    public void ApplyOutlierCut_ReinstatedInvoiceNotCut()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 1000m, new Dictionary<string, decimal> { { "R1", 1000m } }, 0m),
            CreateInvoice("INV-2", 100m, new Dictionary<string, decimal> { { "R1", 100m } }, 0m),
        };

        // INV-1 is reinstated, so it should not be cut
        var reinstated = new HashSet<string> { "INV-1" };
        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, reinstated);

        Assert.Equal(1100m, result.AfterByRegion["R1"]);
        Assert.Empty(result.CutDeals);
    }

    [Fact]
    public void ApplyOutlierCut_HandlesUnmapped()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 1000m, new Dictionary<string, decimal> { { "R1", 800m } }, 200m),
            CreateInvoice("INV-2", 100m, new Dictionary<string, decimal> { { "R1", 100m } }, 0m),
        };

        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        Assert.Equal(200m, result.BeforeUnmapped);
        Assert.Equal(0m, result.AfterUnmapped);
        Assert.Single(result.CutDeals);
    }

    [Fact]
    public void ApplyOutlierCut_MultipleRegions()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 600m, new Dictionary<string, decimal> { { "R1", 400m }, { "R2", 200m } }, 0m),
            CreateInvoice("INV-2", 400m, new Dictionary<string, decimal> { { "R1", 200m }, { "R2", 200m } }, 0m),
        };

        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        Assert.Equal(600m, result.BeforeByRegion["R1"]);
        Assert.Equal(400m, result.BeforeByRegion["R2"]);
        Assert.Single(result.CutDeals);
        Assert.Equal("INV-1", result.CutDeals[0].InvoiceNo);
        Assert.Equal(200m, result.AfterByRegion["R1"]);
        Assert.Equal(200m, result.AfterByRegion["R2"]);
    }

    [Fact]
    public void ApplyOutlierCut_EmptyInvoices()
    {
        var invoices = new UnitInvoice[0];
        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        Assert.Empty(result.BeforeByRegion);
        Assert.Empty(result.AfterByRegion);
        Assert.Equal(0m, result.BeforeUnmapped);
        Assert.Equal(0m, result.AfterUnmapped);
        Assert.Empty(result.CutDeals);
    }

    [Fact]
    public void ApplyOutlierCut_ZeroGrandTotal()
    {
        var invoices = new[]
        {
            CreateInvoice("INV-1", 0m, new Dictionary<string, decimal>(), 0m),
        };

        var result = OutlierCutCalculator.ApplyOutlierCut(invoices, 0.5m, new HashSet<string>());

        // With zero grand total, ratio is 0 which is not > threshold, so no cut deal
        Assert.Empty(result.CutDeals);
        Assert.Equal(0m, result.BeforeByRegion.Values.Sum());
    }
}