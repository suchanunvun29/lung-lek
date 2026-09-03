namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Kpi;
using Xunit;

public class KpiCalculatorTests
{
    private static CreditedLine CreateLine(string hospitalId, string productTypeId, decimal total, int year = 2024, int month = 1)
        => new CreditedLine
        {
            SalesLineId = Guid.NewGuid().ToString(),
            HospitalId = hospitalId,
            ProductTypeId = productTypeId,
            Year = year,
            Month = month,
            InvoiceDate = new DateTime(year, month, 1),
            CreditedTotal = total
        };

    private static NewCustomerCredit CreateNewCustomer(string hospitalId, decimal sharePercent)
        => new NewCustomerCredit
        {
            HospitalId = hospitalId,
            SalesLineId = Guid.NewGuid().ToString(),
            SharePercent = sharePercent
        };

    // ========== RevenueVsTarget Tests ==========

    [Fact]
    public void ComputeRevenueVsTarget_TargetZero_ReturnsNotComputable()
    {
        var lines = new[] { CreateLine("H1", "PT1", 1000m) };
        var targets = new decimal[] { 0m };

        var result = KpiCalculator.ComputeRevenueVsTarget(lines, targets);

        Assert.False(result.Computable);
        Assert.Null(result.Score);
        Assert.Equal("ยังไม่ได้ตั้งเป้า หรือเป้าเป็น 0", result.Reason);
    }

    [Fact]
    public void ComputeRevenueVsTarget_CalculatesCorrectly()
    {
        var lines = new[] { CreateLine("H1", "PT1", 1000m), CreateLine("H2", "PT1", 500m) };
        var targets = new decimal[] { 1200m };

        var result = KpiCalculator.ComputeRevenueVsTarget(lines, targets);

        Assert.True(result.Computable);
        // (1500/1200) * 100 = 125, capped at 100
        Assert.Equal(100m, result.Score);
    }

    [Fact]
    public void ComputeRevenueVsTarget_CapsAt100()
    {
        var lines = new[] { CreateLine("H1", "PT1", 2000m) };
        var targets = new decimal[] { 1000m };

        var result = KpiCalculator.ComputeRevenueVsTarget(lines, targets);

        Assert.True(result.Computable);
        Assert.Equal(100m, result.Score);
    }

    // ========== NewCustomers Tests ==========

    [Fact]
    public void ComputeNewCustomers_TargetZero_ReturnsNotComputable()
    {
        var lines = new[] { CreateNewCustomer("H1", 100m) };
        var result = KpiCalculator.ComputeNewCustomers(lines, 0);

        Assert.False(result.Computable);
        Assert.Null(result.Score);
    }

    [Fact]
    public void ComputeNewCustomers_CalculatesCorrectly()
    {
        var lines = new[] { CreateNewCustomer("H1", 100m), CreateNewCustomer("H2", 50m) }; // 1.5 customers
        var result = KpiCalculator.ComputeNewCustomers(lines, 2);

        Assert.True(result.Computable);
        Assert.Equal((1.5m / 2m) * 100, result.Score);
    }

    [Fact]
    public void ComputeNewCustomers_CapsAt100()
    {
        var lines = new[] { CreateNewCustomer("H1", 100m), CreateNewCustomer("H2", 100m) }; // 2 customers
        var result = KpiCalculator.ComputeNewCustomers(lines, 1);

        Assert.True(result.Computable);
        Assert.Equal(100m, result.Score);
    }

    [Fact]
    public void GetNewCustomerActualCount_ReturnsRoundedCount()
    {
        var lines = new[] { CreateNewCustomer("H1", 100m), CreateNewCustomer("H2", 30m) }; // 1.3 -> 1.3
        var result = KpiCalculator.GetNewCustomerActualCount(lines);

        Assert.Equal(1.3m, result);
    }

    // ========== ProductGroup Tests ==========

    [Fact]
    public void ComputeProductGroup_NoTargets_ReturnsNotComputable()
    {
        var lines = new[] { CreateLine("H1", "PT1", 1000m) };
        var targets = new (string ProductTypeId, string Name, decimal Target)[] { };

        var result = KpiCalculator.ComputeProductGroup(lines, targets);

        Assert.False(result.Computable);
        Assert.Equal("ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้", result.Reason);
    }

    [Fact]
    public void ComputeProductGroup_TotalTargetZero_ReturnsNotComputable()
    {
        var lines = new[] { CreateLine("H1", "PT1", 1000m) };
        var targets = new[] { ("PT1", "Product Type 1", 0m) };

        var result = KpiCalculator.ComputeProductGroup(lines, targets);

        Assert.False(result.Computable);
        Assert.Equal("เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0", result.Reason);
    }

    [Fact]
    public void ComputeProductGroup_CapsActualAtTarget()
    {
        var lines = new[]
        {
            CreateLine("H1", "PT1", 2000m), // actual 2000, target 1000 -> capped at 1000
            CreateLine("H2", "PT2", 500m)   // actual 500, target 1000 -> capped at 500
        };
        var targets = new[]
        {
            ("PT1", "Product Type 1", 1000m),
            ("PT2", "Product Type 2", 1000m)
        };

        var result = KpiCalculator.ComputeProductGroup(lines, targets);

        Assert.True(result.Computable);
        // cappedSum = 1000 + 500 = 1500, totalTarget = 2000
        Assert.Equal(75m, result.Score);
    }

    [Fact]
    public void ComputeProductGroup_IgnoresNonTargetProductTypes()
    {
        var lines = new[]
        {
            CreateLine("H1", "PT1", 1000m), // in target
            CreateLine("H2", "PT3", 5000m)  // NOT in target - should be ignored
        };
        var targets = new[]
        {
            ("PT1", "Product Type 1", 1000m)
        };

        var result = KpiCalculator.ComputeProductGroup(lines, targets);

        Assert.True(result.Computable);
        Assert.Equal(100m, result.Score); // only PT1 counts, actual=target=1000
    }

    // ========== Retention Tests ==========

    private static EvaluationSettings CreateSettings(
        int minMonthsForChurn = 6,
        int minMonthsForConsistency = 6,
        int churnMonths = 3)
        => new EvaluationSettings
        {
            MinMonthsForChurn = minMonthsForChurn,
            MinMonthsForConsistency = minMonthsForConsistency,
            ChurnMonths = churnMonths,
            PotentialMetric = "REVENUE",
            TargetLookbackMonths = 12,
            TargetOutlierThreshold = 0.5m,
            TargetSuggestionAlpha = 0.3m,
            TargetGrowthRate = 1.1m,
            MinRegionCoverage = 0.5m
        };

    [Fact]
    public void ComputeRetention_InsufficientData_ReturnsNotComputable()
    {
        var prevLines = new[] { CreateLine("H1", "PT1", 1000m) };
        var curLines = new[] { CreateLine("H1", "PT1", 1000m) };
        var settings = CreateSettings(minMonthsForChurn: 12);

        var result = KpiCalculator.ComputeRetention(prevLines, curLines, settings, dataCoverageMonths: 6);

        Assert.False(result.Computable);
        Assert.Contains("ข้อมูลยังไม่เพียงพอ", result.Reason!);
    }

    [Fact]
    public void ComputeRetention_NoPreviousCustomers_ReturnsNotComputable()
    {
        var prevLines = new CreditedLine[] { };
        var curLines = new[] { CreateLine("H1", "PT1", 1000m) };
        var settings = CreateSettings();

        var result = KpiCalculator.ComputeRetention(prevLines, curLines, settings, dataCoverageMonths: 12);

        Assert.False(result.Computable);
        Assert.Equal("ไม่มีลูกค้าในงวดก่อนหน้า", result.Reason);
    }

    [Fact]
    public void ComputeRetention_CalculatesCorrectly()
    {
        var prevLines = new[]
        {
            CreateLine("H1", "PT1", 1000m),
            CreateLine("H2", "PT1", 1000m),
            CreateLine("H3", "PT1", 1000m)
        };
        var curLines = new[]
        {
            CreateLine("H1", "PT1", 1000m),
            CreateLine("H2", "PT1", 1000m)
            // H3 is lost
        };
        var settings = CreateSettings();

        var result = KpiCalculator.ComputeRetention(prevLines, curLines, settings, dataCoverageMonths: 12);

        Assert.True(result.Computable);
        Assert.Equal((2m / 3m) * 100, result.Score);
    }

    [Fact]
    public void ComputeRetention_AllRetained()
    {
        var prevLines = new[] { CreateLine("H1", "PT1", 1000m), CreateLine("H2", "PT1", 1000m) };
        var curLines = new[] { CreateLine("H1", "PT1", 1000m), CreateLine("H2", "PT1", 1000m) };
        var settings = CreateSettings();

        var result = KpiCalculator.ComputeRetention(prevLines, curLines, settings, dataCoverageMonths: 12);

        Assert.True(result.Computable);
        Assert.Equal(100m, result.Score);
    }

    [Fact]
    public void ComputeRetention_NoneRetained()
    {
        var prevLines = new[] { CreateLine("H1", "PT1", 1000m), CreateLine("H2", "PT1", 1000m) };
        var curLines = new[] { CreateLine("H3", "PT1", 1000m), CreateLine("H4", "PT1", 1000m) };
        var settings = CreateSettings();

        var result = KpiCalculator.ComputeRetention(prevLines, curLines, settings, dataCoverageMonths: 12);

        Assert.True(result.Computable);
        Assert.Equal(0m, result.Score);
    }

    // ========== Consistency Tests ==========

    [Fact]
    public void ComputeConsistency_InsufficientData_ReturnsNotComputable()
    {
        var lines = new[] { CreateLine("H1", "PT1", 1000m, 2024, 1) };
        var settings = CreateSettings(minMonthsForConsistency: 12);

        var result = KpiCalculator.ComputeConsistency(lines, settings, dataCoverageMonths: 6);

        Assert.False(result.Computable);
        Assert.Contains("ข้อมูลยังไม่เพียงพอ", result.Reason!);
    }

    [Fact]
    public void ComputeConsistency_ZeroMean_ReturnsNotComputable()
    {
        var lines = new CreditedLine[] { }; // no sales = zero mean
        var settings = CreateSettings();

        var result = KpiCalculator.ComputeConsistency(lines, settings, dataCoverageMonths: 12);

        Assert.False(result.Computable);
        Assert.Equal("ยังไม่มีข้อมูลยอดขายในช่วงที่พิจารณา", result.Reason);
    }

    [Fact]
    public void ComputeConsistency_PerfectConsistency_Returns100()
    {
        // 6 months of exactly 1000 each = CV = 0 = score 100
        var lines = new[]
        {
            CreateLine("H1", "PT1", 1000m, 2024, 1),
            CreateLine("H1", "PT1", 1000m, 2024, 2),
            CreateLine("H1", "PT1", 1000m, 2024, 3),
            CreateLine("H1", "PT1", 1000m, 2024, 4),
            CreateLine("H1", "PT1", 1000m, 2024, 5),
            CreateLine("H1", "PT1", 1000m, 2024, 6)
        };
        var settings = CreateSettings(minMonthsForConsistency: 6);

        var result = KpiCalculator.ComputeConsistency(lines, settings, dataCoverageMonths: 12);

        Assert.True(result.Computable);
        Assert.Equal(100m, result.Score);
    }

    [Fact]
    public void ComputeConsistency_HighVariance_ReturnsLowerScore()
    {
        // Alternating 0 and 2000: mean = 1000, stddev = 1000, CV = 1, score = 0
        var lines = new[]
        {
            CreateLine("H1", "PT1", 0m, 2024, 1),
            CreateLine("H1", "PT1", 2000m, 2024, 2),
            CreateLine("H1", "PT1", 0m, 2024, 3),
            CreateLine("H1", "PT1", 2000m, 2024, 4),
            CreateLine("H1", "PT1", 0m, 2024, 5),
            CreateLine("H1", "PT1", 2000m, 2024, 6)
        };
        var settings = CreateSettings(minMonthsForConsistency: 6);

        var result = KpiCalculator.ComputeConsistency(lines, settings, dataCoverageMonths: 12);

        Assert.True(result.Computable);
        Assert.Equal(0m, result.Score);
    }
}