namespace SalesEvaluation.Domain.Kpi;

public enum KpiMetric
{
    RevenueVsTarget,
    NewCustomers,
    ProductGroup,
    Retention,
    Consistency
}

public sealed class MetricResult
{
    public required KpiMetric Metric { get; init; }
    public required bool Computable { get; init; }
    public required decimal? Score { get; init; }
    public required string? Reason { get; init; }
    public required Dictionary<string, object> Detail { get; init; }
}

public sealed class CreditedLine
{
    public required string SalesLineId { get; init; }
    public required string HospitalId { get; init; }
    public required string ProductTypeId { get; init; }
    public required int Year { get; init; }
    public required int Month { get; init; }
    public required DateTime InvoiceDate { get; init; }
    public required decimal CreditedTotal { get; init; }
}

public sealed class NewCustomerCredit
{
    public required string HospitalId { get; init; }
    public required string SalesLineId { get; init; }
    public required decimal SharePercent { get; init; }
}

public sealed class ScoringWeight
{
    public required KpiMetric Metric { get; init; }
    public required decimal Weight { get; init; }
}

public sealed class EvaluationSettings
{
    public required int MinMonthsForChurn { get; init; }
    public required int MinMonthsForConsistency { get; init; }
    public required int ChurnMonths { get; init; }
    public required string PotentialMetric { get; init; }
    public required int TargetLookbackMonths { get; init; }
    public required decimal TargetOutlierThreshold { get; init; }
    public required decimal TargetSuggestionAlpha { get; init; }
    public required decimal TargetGrowthRate { get; init; }
    public required decimal MinRegionCoverage { get; init; }
}

public sealed class PeriodKey
{
    public required int Year { get; init; }
    public required int Month { get; init; }
    public required string PeriodType { get; init; } // "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"
}

public static class PeriodHelper
{
    public static List<(int Year, int Month)> MonthsInPeriod(PeriodKey period)
    {
        var months = new List<(int Year, int Month)>();

        switch (period.PeriodType.ToUpperInvariant())
        {
            case "MONTHLY":
                months.Add((period.Year, period.Month));
                break;

            case "QUARTERLY":
                var startMonth = ((period.Month - 1) / 3) * 3 + 1;
                for (int m = 0; m < 3; m++)
                {
                    var ym = startMonth + m;
                    months.Add((period.Year, ym));
                }
                break;

            case "SEMI_ANNUAL":
                var halfStartMonth = period.Month <= 6 ? 1 : 7;
                for (int m = 0; m < 6; m++)
                {
                    months.Add((period.Year, halfStartMonth + m));
                }
                break;

            case "ANNUAL":
                for (int m = 1; m <= 12; m++)
                {
                    months.Add((period.Year, m));
                }
                break;
        }

        return months;
    }

    public static (int Year, int Month) LastMonthOfPeriod(PeriodKey period)
    {
        var months = MonthsInPeriod(period);
        return months.Last();
    }

    public static PeriodKey PreviousPeriod(PeriodKey period)
    {
        switch (period.PeriodType.ToUpperInvariant())
        {
            case "MONTHLY":
                if (period.Month == 1)
                    return new PeriodKey { Year = period.Year - 1, Month = 12, PeriodType = "MONTHLY" };
                return new PeriodKey { Year = period.Year, Month = period.Month - 1, PeriodType = "MONTHLY" };

            case "QUARTERLY":
                var quarter = (period.Month - 1) / 3 + 1;
                if (quarter == 1)
                    return new PeriodKey { Year = period.Year - 1, Month = 10, PeriodType = "QUARTERLY" };
                return new PeriodKey { Year = period.Year, Month = (quarter - 2) * 3 + 1, PeriodType = "QUARTERLY" };

            case "SEMI_ANNUAL":
                if (period.Month == 1)
                    return new PeriodKey { Year = period.Year - 1, Month = 7, PeriodType = "SEMI_ANNUAL" };
                return new PeriodKey { Year = period.Year, Month = 1, PeriodType = "SEMI_ANNUAL" };

            case "ANNUAL":
                return new PeriodKey { Year = period.Year - 1, Month = 1, PeriodType = "ANNUAL" };

            default:
                return period;
        }
    }

    public static List<(int Year, int Month)> TrailingMonths(int endYear, int endMonth, int count)
    {
        var months = new List<(int Year, int Month)>();
        var year = endYear;
        var month = endMonth;

        for (int i = 0; i < count; i++)
        {
            months.Add((year, month));
            month--;
            if (month == 0)
            {
                month = 12;
                year--;
            }
        }

        months.Reverse();
        return months;
    }

    public static string MonthKey((int Year, int Month) ym) => $"{ym.Year}-{ym.Month:D2}";
}