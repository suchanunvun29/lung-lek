namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Http;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Domain.Enums;

/// <summary>
/// Query parsing shared by the KPI/leaderboard family — mirrors the zod pipelines in
/// kpi.validators.ts / territoryLeaderboard.validators.ts: periodNumber validity per periodType
/// and YEAR periods normalized to periodNumber 0.
/// </summary>
internal static class PeriodQueryParser
{
    private const string PeriodNumberRangeMessageTh = "periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)";

    private static readonly string[] ValidPeriodTypes = { "MONTH", "QUARTER", "YEAR" };
    private static readonly string[] ValidCriteria = { "COMPOSITE", "PERCENT_TARGET", "REVENUE", "NEW_CUSTOMERS" };

    /// <summary>
    /// T-UX-029 — the single period contract. Every endpoint family (KPI/leaderboard,
    /// territory view, report, coaching) parses query/body periods through here so the
    /// range rules and the Thai error text are identical everywhere. MONTH requires
    /// periodNumber 1-12, QUARTER 1-4, YEAR normalizes periodNumber to 0 (so a client may
    /// omit it or send 0).
    /// </summary>
    internal static bool TryParsePeriod(string? periodType, string? year, string? periodNumber, out AppPeriodKey period, out IResult? error)
    {
        period = default;
        error = null;

        if (string.IsNullOrEmpty(periodType) || !ValidPeriodTypes.Contains(periodType))
        {
            error = TerritoryEndpoints.Invalid("periodType must be one of MONTH, QUARTER, YEAR");
            return false;
        }

        var parsedType = Enum.Parse<PeriodType>(periodType, ignoreCase: false);

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedYear))
        {
            error = TerritoryEndpoints.Invalid("year must be an integer");
            return false;
        }

        var hasPeriodNumber = !string.IsNullOrEmpty(periodNumber);
        var parsedPeriodNumber = 0;
        if (hasPeriodNumber && !int.TryParse(periodNumber, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsedPeriodNumber))
        {
            error = TerritoryEndpoints.Invalid("periodNumber must be an integer");
            return false;
        }

        // periodNumber ไม่ถูกต้อง — MONTH requires 1-12, QUARTER requires 1-4.
        if (parsedType == PeriodType.MONTH && (!hasPeriodNumber || parsedPeriodNumber < 1 || parsedPeriodNumber > 12))
        {
            error = TerritoryEndpoints.Invalid(PeriodNumberRangeMessageTh);
            return false;
        }

        if (parsedType == PeriodType.QUARTER && (!hasPeriodNumber || parsedPeriodNumber < 1 || parsedPeriodNumber > 4))
        {
            error = TerritoryEndpoints.Invalid(PeriodNumberRangeMessageTh);
            return false;
        }

        // normalizePeriodNumber: YEAR periods carry periodNumber 0.
        if (parsedType == PeriodType.YEAR)
        {
            parsedPeriodNumber = 0;
        }

        period = new AppPeriodKey(parsedType, parsedYear, parsedPeriodNumber);
        return true;
    }

    internal static bool TryParsePeriod(IQueryCollection query, out AppPeriodKey period, out IResult? error)
    {
        var periodType = query.TryGetValue("periodType", out var periodTypeValue) ? periodTypeValue.ToString() : null;
        var year = query.TryGetValue("year", out var yearValue) ? yearValue.ToString() : null;
        var periodNumber = query.TryGetValue("periodNumber", out var periodNumberValue) ? periodNumberValue.ToString() : null;
        return TryParsePeriod(periodType, year, periodNumber, out period, out error);
    }

    /// <summary>
    /// T-UX-029 — same rules for JSON-body periods (coaching generate): MONTH/QUARTER must
    /// carry an in-range periodNumber, YEAR is normalized to 0 regardless of what was sent.
    /// </summary>
    internal static (AppPeriodKey Period, IResult? Error) ValidateBodyPeriod(PeriodType periodType, int year, int periodNumber)
    {
        if (periodType == PeriodType.MONTH && periodNumber is < 1 or > 12)
            return (default, TerritoryEndpoints.Invalid(PeriodNumberRangeMessageTh));
        if (periodType == PeriodType.QUARTER && periodNumber is < 1 or > 4)
            return (default, TerritoryEndpoints.Invalid(PeriodNumberRangeMessageTh));

        var normalized = periodType == PeriodType.YEAR ? 0 : periodNumber;
        return (new AppPeriodKey(periodType, year, normalized), null);
    }

    internal static bool TryParseCriteria(IQueryCollection query, out string criteria, out IResult? error)
    {
        criteria = string.Empty;
        error = null;

        if (!query.TryGetValue("criteria", out var criteriaValue) || !ValidCriteria.Contains(criteriaValue.ToString()))
        {
            error = TerritoryEndpoints.Invalid($"criteria must be one of {string.Join(", ", ValidCriteria)}");
            return false;
        }

        criteria = criteriaValue.ToString();
        return true;
    }
}
