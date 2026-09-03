namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Kpi;
using Xunit;

public class CompositeScoreCalculatorTests
{
    private static MetricResult CreateMetric(KpiMetric metric, bool computable, decimal? score, string? reason = null, Dictionary<string, object>? detail = null)
        => new MetricResult
        {
            Metric = metric,
            Computable = computable,
            Score = score,
            Reason = reason,
            Detail = detail ?? new Dictionary<string, object>()
        };

    private static IReadOnlyDictionary<KpiMetric, decimal> CreateWeights(
        decimal revenueWeight = 40,
        decimal newCustWeight = 20,
        decimal productWeight = 20,
        decimal retentionWeight = 10,
        decimal consistencyWeight = 10)
        => new Dictionary<KpiMetric, decimal>
        {
            { KpiMetric.RevenueVsTarget, revenueWeight },
            { KpiMetric.NewCustomers, newCustWeight },
            { KpiMetric.ProductGroup, productWeight },
            { KpiMetric.Retention, retentionWeight },
            { KpiMetric.Consistency, consistencyWeight }
        };

    [Fact]
    public void ComputeCompositeScore_NoComputableMetrics_ReturnsNullComposite()
    {
        var metrics = new List<MetricResult>
        {
            CreateMetric(KpiMetric.RevenueVsTarget, false, null),
            CreateMetric(KpiMetric.NewCustomers, false, null),
            CreateMetric(KpiMetric.ProductGroup, false, null),
            CreateMetric(KpiMetric.Retention, false, null),
            CreateMetric(KpiMetric.Consistency, false, null)
        };
        var weights = CreateWeights();

        var result = CompositeScoreCalculator.ComputeCompositeScore(metrics, weights);

        Assert.Null(result.Composite);
        Assert.Equal(0, result.ComputedFromCount);
        Assert.Equal("คิดจาก 0 จาก 5 เกณฑ์", result.ComputedFromLabel);
        Assert.Contains("ยังไม่มีคะแนนรวม", result.Message!);
    }

    [Fact]
    public void ComputeCompositeScore_AllComputable_CalculatesWeightedAverage()
    {
        var metrics = new List<MetricResult>
        {
            CreateMetric(KpiMetric.RevenueVsTarget, true, 80m),
            CreateMetric(KpiMetric.NewCustomers, true, 100m),
            CreateMetric(KpiMetric.ProductGroup, true, 75m),
            CreateMetric(KpiMetric.Retention, true, 90m),
            CreateMetric(KpiMetric.Consistency, true, 85m)
        };
        var weights = CreateWeights();

        var result = CompositeScoreCalculator.ComputeCompositeScore(metrics, weights);

        // Weighted average: (40*80 + 20*100 + 20*75 + 10*90 + 10*85) / 100 = (3200+2000+1500+900+850)/100 = 8450/100 = 84.5
        Assert.Equal(84.5m, result.Composite);
        Assert.Equal(5, result.ComputedFromCount);
        Assert.Equal("คิดจาก 5 จาก 5 เกณฑ์", result.ComputedFromLabel);
        Assert.Null(result.Message);
    }

    [Fact]
    public void ComputeCompositeScore_PartialComputable_WeightsOnlyFromComputable()
    {
        var metrics = new List<MetricResult>
        {
            CreateMetric(KpiMetric.RevenueVsTarget, true, 80m),
            CreateMetric(KpiMetric.NewCustomers, false, null), // not computable
            CreateMetric(KpiMetric.ProductGroup, true, 75m),
            CreateMetric(KpiMetric.Retention, false, null), // not computable
            CreateMetric(KpiMetric.Consistency, true, 85m)
        };
        var weights = CreateWeights();

        var result = CompositeScoreCalculator.ComputeCompositeScore(metrics, weights);

        // Only Revenue(40), Product(20), Consistency(10) = 70 total weight
        // Weighted: (40*80 + 20*75 + 10*85) / 70 = (3200+1500+850)/70 = 5550/70 = 79.2857... -> 79.29
        Assert.Equal(79.29m, result.Composite);
        Assert.Equal(3, result.ComputedFromCount);
        Assert.Equal("คิดจาก 3 จาก 5 เกณฑ์", result.ComputedFromLabel);
    }

    [Fact]
    public void ComputeCompositeScore_ZeroWeightSum_ReturnsNullComposite()
    {
        var metrics = new List<MetricResult>
        {
            CreateMetric(KpiMetric.RevenueVsTarget, true, 80m),
            CreateMetric(KpiMetric.NewCustomers, true, 100m),
            CreateMetric(KpiMetric.ProductGroup, false, null),
            CreateMetric(KpiMetric.Retention, false, null),
            CreateMetric(KpiMetric.Consistency, false, null)
        };
        var weights = new Dictionary<KpiMetric, decimal>
        {
            { KpiMetric.RevenueVsTarget, 0 },
            { KpiMetric.NewCustomers, 0 },
            { KpiMetric.ProductGroup, 0 },
            { KpiMetric.Retention, 0 },
            { KpiMetric.Consistency, 0 }
        };

        var result = CompositeScoreCalculator.ComputeCompositeScore(metrics, weights);

        Assert.Null(result.Composite);
        Assert.Equal(2, result.ComputedFromCount);
        Assert.Contains("น้ำหนักรวมของเกณฑ์ที่คำนวณได้เป็น 0", result.Message!);
    }

    [Fact]
    public void ComputeCompositeScore_RoundsToTwoDecimals()
    {
        var metrics = new List<MetricResult>
        {
            CreateMetric(KpiMetric.RevenueVsTarget, true, 80m),
            CreateMetric(KpiMetric.NewCustomers, true, 100m),
            CreateMetric(KpiMetric.ProductGroup, true, 33.33m),
            CreateMetric(KpiMetric.Retention, false, null),
            CreateMetric(KpiMetric.Consistency, false, null)
        };
        var weights = new Dictionary<KpiMetric, decimal>
        {
            { KpiMetric.RevenueVsTarget, 33 },
            { KpiMetric.NewCustomers, 33 },
            { KpiMetric.ProductGroup, 34 },
            { KpiMetric.Retention, 0 },
            { KpiMetric.Consistency, 0 }
        };

        var result = CompositeScoreCalculator.ComputeCompositeScore(metrics, weights);

        // (33*80 + 33*100 + 34*33.33) / 100 = (2640 + 3300 + 1133.22) / 100 = 7073.22 / 100 = 70.7322 -> 70.73
        Assert.Equal(70.73m, result.Composite);
    }

    [Fact]
    public void TeamAverageComposite_NoScores_ReturnsNull()
    {
        var entries = new List<CompositeScoreResult>
        {
            new() { Composite = null, Metrics = new List<MetricResult>() },
            new() { Composite = null, Metrics = new List<MetricResult>() }
        };

        var result = CompositeScoreCalculator.TeamAverageComposite(entries);

        Assert.Null(result);
    }

    [Fact]
    public void TeamAverageComposite_AveragesValidScores()
    {
        var entries = new List<CompositeScoreResult>
        {
            new() { Composite = 80m, Metrics = new List<MetricResult>() },
            new() { Composite = 100m, Metrics = new List<MetricResult>() },
            new() { Composite = 60m, Metrics = new List<MetricResult>() },
            new() { Composite = null, Metrics = new List<MetricResult>() } // ignored
        };

        var result = CompositeScoreCalculator.TeamAverageComposite(entries);

        Assert.Equal(80m, result); // (80+100+60)/3 = 80
    }

    [Fact]
    public void TeamAverageComposite_RoundsToTwoDecimals()
    {
        var entries = new List<CompositeScoreResult>
        {
            new() { Composite = 80m, Metrics = new List<MetricResult>() },
            new() { Composite = 100m, Metrics = new List<MetricResult>() }
        };

        var result = CompositeScoreCalculator.TeamAverageComposite(entries);

        Assert.Equal(90m, result);
    }
}