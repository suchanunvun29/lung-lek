namespace SalesEvaluation.Domain.Kpi;

using System.Collections.Generic;
using System.Linq;

public sealed class CompositeScoreResult
{
    public decimal? Composite { get; init; }
    public int ComputedFromCount { get; init; }
    public string ComputedFromLabel { get; init; } = string.Empty;
    public string? Message { get; init; }
    public required List<MetricResult> Metrics { get; init; }
}

public static class CompositeScoreCalculator
{
    private static readonly KpiMetric[] MetricOrder =
    [
        KpiMetric.RevenueVsTarget,
        KpiMetric.NewCustomers,
        KpiMetric.ProductGroup,
        KpiMetric.Retention,
        KpiMetric.Consistency
    ];

    public static CompositeScoreResult ComputeCompositeScore(
        List<MetricResult> metricResults,
        IReadOnlyDictionary<KpiMetric, decimal> weights)
    {
        var orderedResults = MetricOrder
            .Select(m => metricResults.First(r => r.Metric == m))
            .ToList();

        var computable = orderedResults.Where(r => r.Computable).ToList();

        if (computable.Count == 0)
        {
            return new CompositeScoreResult
            {
                Composite = null,
                ComputedFromCount = 0,
                ComputedFromLabel = "คิดจาก 0 จาก 5 เกณฑ์",
                Message = "ยังไม่มีคะแนนรวม เนื่องจากยังไม่มีเกณฑ์ใดคำนวณได้ในงวดนี้",
                Metrics = orderedResults
            };
        }

        var weightedSum = computable.Sum(r => (weights.GetValueOrDefault(r.Metric) * (r.Score ?? 0)));
        var weightSum = computable.Sum(r => weights.GetValueOrDefault(r.Metric));

        var composite = weightSum > 0 ? weightedSum / weightSum : (decimal?)null;

        return new CompositeScoreResult
        {
            Composite = composite.HasValue ? Math.Round(composite.Value * 100) / 100 : null,
            ComputedFromCount = computable.Count,
            ComputedFromLabel = $"คิดจาก {computable.Count} จาก 5 เกณฑ์",
            Message = composite == null
                ? "ยังไม่มีคะแนนรวม เนื่องจากน้ำหนักรวมของเกณฑ์ที่คำนวณได้เป็น 0"
                : null,
            Metrics = orderedResults
        };
    }

    public static decimal? TeamAverageComposite(IEnumerable<CompositeScoreResult> entries)
    {
        var scores = entries
            .Select(e => e.Composite)
            .Where(s => s.HasValue)
            .Select(s => s!.Value)
            .ToList();

        if (scores.Count == 0)
            return null;

        return Math.Round((scores.Average()) * 100) / 100;
    }
}