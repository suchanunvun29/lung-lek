namespace SalesEvaluation.Domain.Kpi;

using System.Collections.Generic;
using System.Linq;

public static class KpiCalculator
{
    private const string InsufficientDataFormat = "ข้อมูลยังไม่เพียงพอ ต้องการ {0} เดือน ปัจจุบันมี {1} เดือน";

    public static MetricResult ComputeRevenueVsTarget(
        IEnumerable<CreditedLine> creditedLines,
        IEnumerable<decimal> targets)
    {
        var actual = creditedLines.Sum(l => l.CreditedTotal);
        var target = targets.Sum();

        if (target == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.RevenueVsTarget,
                Computable = false,
                Score = null,
                Reason = "ยังไม่ได้ตั้งเป้า หรือเป้าเป็น 0",
                Detail = new Dictionary<string, object> { { "actual", actual }, { "target", target } }
            };
        }

        var achievementPercent = (double)(actual / target) * 100;
        return new MetricResult
        {
            Metric = KpiMetric.RevenueVsTarget,
            Computable = true,
            Score = (decimal)Math.Min(achievementPercent, 100),
            Reason = null,
            Detail = new Dictionary<string, object>
            {
                { "actual", actual },
                { "target", target },
                { "achievementPercent", (decimal)achievementPercent }
            }
        };
    }

    public static MetricResult ComputeNewCustomers(
        IEnumerable<NewCustomerCredit> creditedLines,
        int target)
    {
        if (target == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.NewCustomers,
                Computable = false,
                Score = null,
                Reason = "ยังไม่ได้ตั้งเป้าลูกค้าใหม่",
                Detail = new Dictionary<string, object>
                {
                    { "actual", 0m },
                    { "target", target },
                    { "hospitalIds", new List<string>() }
                }
            };
        }

        var actual = creditedLines.Sum(l => l.SharePercent / 100m);
        var actualRounded = Math.Round(actual * 10) / 10m;

        return new MetricResult
        {
            Metric = KpiMetric.NewCustomers,
            Computable = true,
            Score = (decimal)Math.Min((double)actual / target * 100, 100),
            Reason = null,
            Detail = new Dictionary<string, object>
            {
                { "actual", actualRounded },
                { "target", target },
                { "hospitalIds", creditedLines.Select(l => l.HospitalId).ToList() }
            }
        };
    }

    public static decimal GetNewCustomerActualCount(IEnumerable<NewCustomerCredit> creditedLines)
    {
        var actual = creditedLines.Sum(l => l.SharePercent / 100m);
        return Math.Round(actual * 10) / 10m;
    }

    public static MetricResult ComputeProductGroup(
        IEnumerable<CreditedLine> creditedLines,
        IEnumerable<(string ProductTypeId, string Name, decimal Target)> targetGroups)
    {
        var targetGroupsList = targetGroups.ToList();

        if (targetGroupsList.Count == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.ProductGroup,
                Computable = false,
                Score = null,
                Reason = "ไม่มีการตั้งเป้ากลุ่มสินค้าในงวดนี้",
                Detail = new Dictionary<string, object> { { "groups", new List<object>() } }
            };
        }

        var totalTarget = targetGroupsList.Sum(g => g.Target);
        if (totalTarget == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.ProductGroup,
                Computable = false,
                Score = null,
                Reason = "เป้ากลุ่มสินค้าที่ตั้งไว้รวมเป็น 0",
                Detail = new Dictionary<string, object> { { "groups", new List<object>() } }
            };
        }

        var actualByType = new Dictionary<string, decimal>();
        foreach (var line in creditedLines)
        {
            if (!targetGroupsList.Any(g => g.ProductTypeId == line.ProductTypeId))
                continue;

            actualByType[line.ProductTypeId] = actualByType.GetValueOrDefault(line.ProductTypeId) + line.CreditedTotal;
        }

        var cappedSum = 0m;
        var groups = targetGroupsList.Select(g =>
        {
            var actual = actualByType.GetValueOrDefault(g.ProductTypeId);
            var cappedActual = Math.Min(actual, g.Target);
            cappedSum += cappedActual;
            return new
            {
                g.ProductTypeId,
                g.Name,
                actual,
                target = g.Target,
                cappedActual
            };
        }).Cast<object>().ToList();

        return new MetricResult
        {
            Metric = KpiMetric.ProductGroup,
            Computable = true,
            Score = (cappedSum / totalTarget) * 100,
            Reason = null,
            Detail = new Dictionary<string, object>
            {
                { "groups", groups },
                { "totalTarget", totalTarget },
                { "cappedSum", cappedSum }
            }
        };
    }

    public static MetricResult ComputeRetention(
        IEnumerable<CreditedLine> prevCreditedLines,
        IEnumerable<CreditedLine> curCreditedLines,
        EvaluationSettings settings,
        int dataCoverageMonths)
    {
        if (dataCoverageMonths < settings.MinMonthsForChurn)
        {
            return new MetricResult
            {
                Metric = KpiMetric.Retention,
                Computable = false,
                Score = null,
                Reason = string.Format(InsufficientDataFormat, settings.MinMonthsForChurn, dataCoverageMonths),
                Detail = new Dictionary<string, object>()
            };
        }

        var prevHospitalIds = prevCreditedLines.Select(l => l.HospitalId).Distinct().ToList();

        if (prevHospitalIds.Count == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.Retention,
                Computable = false,
                Score = null,
                Reason = "ไม่มีลูกค้าในงวดก่อนหน้า",
                Detail = new Dictionary<string, object>()
            };
        }

        var curSet = new HashSet<string>(curCreditedLines.Select(l => l.HospitalId));
        var retainedHospitalIds = prevHospitalIds.Where(id => curSet.Contains(id)).ToList();

        return new MetricResult
        {
            Metric = KpiMetric.Retention,
            Computable = true,
            Score = (decimal)retainedHospitalIds.Count / prevHospitalIds.Count * 100,
            Reason = null,
            Detail = new Dictionary<string, object>
            {
                { "previousHospitalCount", prevHospitalIds.Count },
                { "retainedHospitalCount", retainedHospitalIds.Count },
                { "retainedHospitalIds", retainedHospitalIds },
                { "previousPeriod", "previous" }
            }
        };
    }

    public static MetricResult ComputeConsistency(
        IEnumerable<CreditedLine> trailingCreditedLines,
        EvaluationSettings settings,
        int dataCoverageMonths)
    {
        if (dataCoverageMonths < settings.MinMonthsForConsistency)
        {
            return new MetricResult
            {
                Metric = KpiMetric.Consistency,
                Computable = false,
                Score = null,
                Reason = string.Format(InsufficientDataFormat, settings.MinMonthsForConsistency, dataCoverageMonths),
                Detail = new Dictionary<string, object>()
            };
        }

        var sumMap = new Dictionary<string, decimal>();
        foreach (var line in trailingCreditedLines)
        {
            var key = PeriodHelper.MonthKey((line.Year, line.Month));
            sumMap[key] = sumMap.GetValueOrDefault(key) + line.CreditedTotal;
        }

        // If no trailing lines, return not computable
        if (!trailingCreditedLines.Any())
        {
            return new MetricResult
            {
                Metric = KpiMetric.Consistency,
                Computable = false,
                Score = null,
                Reason = "ยังไม่มีข้อมูลยอดขายในช่วงที่พิจารณา",
                Detail = new Dictionary<string, object>()
            };
        }

        var trailingMonths = PeriodHelper.TrailingMonths(
            trailingCreditedLines.Max(l => l.Year),
            trailingCreditedLines.Max(l => l.Month),
            settings.MinMonthsForConsistency);

        var monthlyValues = trailingMonths
            .Select(m => sumMap.GetValueOrDefault(PeriodHelper.MonthKey(m)))
            .ToList();

        var mean = monthlyValues.Average();
        if (mean == 0)
        {
            return new MetricResult
            {
                Metric = KpiMetric.Consistency,
                Computable = false,
                Score = null,
                Reason = "ยอดขายเฉลี่ยในช่วงที่พิจารณาเป็น 0",
                Detail = new Dictionary<string, object>
                {
                    { "trailing", trailingMonths },
                    { "monthlyValues", monthlyValues }
                }
            };
        }

        var variance = monthlyValues.Average(v => (double)Math.Pow((double)(v - mean), 2));
        var stddev = Math.Sqrt(variance);
        var cv = stddev / (double)mean;

        return new MetricResult
        {
            Metric = KpiMetric.Consistency,
            Computable = true,
            Score = (decimal)Math.Max(0, 1 - cv) * 100,
            Reason = null,
            Detail = new Dictionary<string, object>
            {
                { "trailing", trailingMonths },
                { "monthlyValues", monthlyValues },
                { "mean", mean },
                { "stddev", (decimal)stddev },
                { "cv", (decimal)cv }
            }
        };
    }
}