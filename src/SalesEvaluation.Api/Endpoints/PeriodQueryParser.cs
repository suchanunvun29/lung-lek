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
    private static readonly string[] ValidPeriodTypes = { "MONTH", "QUARTER", "YEAR" };
    private static readonly string[] ValidCriteria = { "COMPOSITE", "PERCENT_TARGET", "REVENUE", "NEW_CUSTOMERS" };

    internal static bool TryParsePeriod(IQueryCollection query, out AppPeriodKey period, out IResult? error)
    {
        period = default;
        error = null;

        if (!query.TryGetValue("periodType", out var periodTypeValue) || !ValidPeriodTypes.Contains(periodTypeValue.ToString()))
        {
            error = TerritoryEndpoints.Invalid("periodType must be one of MONTH, QUARTER, YEAR");
            return false;
        }

        var periodType = Enum.Parse<PeriodType>(periodTypeValue.ToString(), ignoreCase: false);

        if (!query.TryGetValue("year", out var yearValue) ||
            !int.TryParse(yearValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var year))
        {
            error = TerritoryEndpoints.Invalid("year must be an integer");
            return false;
        }

        var hasPeriodNumber = query.TryGetValue("periodNumber", out var periodNumberValue) && !string.IsNullOrEmpty(periodNumberValue);
        var periodNumber = 0;
        if (hasPeriodNumber && !int.TryParse(periodNumberValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out periodNumber))
        {
            error = TerritoryEndpoints.Invalid("periodNumber must be an integer");
            return false;
        }

        // periodNumber ไม่ถูกต้อง — MONTH requires 1-12, QUARTER requires 1-4.
        if (periodType == PeriodType.MONTH && (!hasPeriodNumber || periodNumber < 1 || periodNumber > 12))
        {
            error = TerritoryEndpoints.Invalid("periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)");
            return false;
        }

        if (periodType == PeriodType.QUARTER && (!hasPeriodNumber || periodNumber < 1 || periodNumber > 4))
        {
            error = TerritoryEndpoints.Invalid("periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)");
            return false;
        }

        // normalizePeriodNumber: YEAR periods carry periodNumber 0.
        if (periodType == PeriodType.YEAR)
        {
            periodNumber = 0;
        }

        period = new AppPeriodKey(periodType, year, periodNumber);
        return true;
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
