namespace SalesEvaluation.Application.Common;

using SalesEvaluation.Domain.Enums;

/// <summary>
/// Period helpers mirroring backend/src/services/period.util.ts. A period key is
/// (periodType, year, periodNumber) — MONTH: 1-12, QUARTER: 1-4, YEAR: 0.
/// </summary>
public readonly record struct AppPeriodKey(PeriodType PeriodType, int Year, int PeriodNumber);

public static class PeriodUtils
{
    public static List<(int Year, int Month)> MonthsInPeriod(AppPeriodKey period) => period.PeriodType switch
    {
        PeriodType.MONTH => new List<(int, int)> { (period.Year, period.PeriodNumber) },
        PeriodType.QUARTER => new List<(int, int)>
        {
            (period.Year, (period.PeriodNumber - 1) * 3 + 1),
            (period.Year, (period.PeriodNumber - 1) * 3 + 2),
            (period.Year, (period.PeriodNumber - 1) * 3 + 3)
        },
        _ => Enumerable.Range(1, 12).Select(m => (period.Year, m)).ToList()
    };

    public static AppPeriodKey PreviousPeriod(AppPeriodKey period) => period.PeriodType switch
    {
        PeriodType.MONTH => period.PeriodNumber == 1
            ? new AppPeriodKey(PeriodType.MONTH, period.Year - 1, 12)
            : new AppPeriodKey(PeriodType.MONTH, period.Year, period.PeriodNumber - 1),
        PeriodType.QUARTER => period.PeriodNumber == 1
            ? new AppPeriodKey(PeriodType.QUARTER, period.Year - 1, 4)
            : new AppPeriodKey(PeriodType.QUARTER, period.Year, period.PeriodNumber - 1),
        _ => new AppPeriodKey(PeriodType.YEAR, period.Year - 1, 0)
    };

    public static (int Year, int Month) LastMonthOfPeriod(AppPeriodKey period)
    {
        var months = MonthsInPeriod(period);
        return months[^1];
    }

    public static DateOnly FirstDayOfPeriod(AppPeriodKey period)
    {
        var first = MonthsInPeriod(period)[0];
        return new DateOnly(first.Year, first.Month, 1);
    }

    public static DateOnly LastDayOfPeriod(AppPeriodKey period)
    {
        var last = LastMonthOfPeriod(period);
        return new DateOnly(last.Year, last.Month, DateTime.DaysInMonth(last.Year, last.Month));
    }

    public static List<(int Year, int Month)> TrailingMonths(int endYear, int endMonth, int count)
    {
        var result = new List<(int Year, int Month)>();
        var year = endYear;
        var month = endMonth;
        for (var i = 0; i < count; i++)
        {
            result.Add((year, month));
            month -= 1;
            if (month == 0)
            {
                month = 12;
                year -= 1;
            }
        }

        result.Reverse();
        return result;
    }

    /// <summary>SalesLine (year, month) filter as a translatable month key.</summary>
    public static int MonthKey(int year, int month) => year * 12 + (month - 1);

    public static List<int> MonthKeys(List<(int Year, int Month)> months) =>
        months.Select(m => MonthKey(m.Year, m.Month)).ToList();

    public static string MonthLabel(int year, int month) => $"{year}-{month}";
}
