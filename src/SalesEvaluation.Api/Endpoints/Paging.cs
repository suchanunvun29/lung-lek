namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Http;

/// <summary>
/// T-UX-025 — the one page/pageSize query contract, shared by /users, /hospitals,
/// /import-batches and /targets/{id}/revisions (same bounds and messages as /sales-lines).
/// Pagination is opt-in: when neither parameter is sent, callers get the legacy
/// full-list shape so existing consumers are not broken.
/// </summary>
internal static class Paging
{
    internal const int DefaultPageSize = 50;
    internal const int MaxPageSize = 200;

    /// <summary>True when either query parameter is present (opt in to paged shape).</summary>
    internal static bool IsRequested(string? page, string? pageSize) =>
        !string.IsNullOrEmpty(page) || !string.IsNullOrEmpty(pageSize);

    /// <summary>Parses page/pageSize with sales-lines bounds. Returns an error IResult on invalid input.</summary>
    internal static (int Page, int PageSize, IResult? Error) Parse(string? page, string? pageSize)
    {
        int pageVal = 1, pageSizeVal = DefaultPageSize;
        if (!string.IsNullOrEmpty(page))
        {
            if (!int.TryParse(page, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageVal) || pageVal < 1)
                return (0, 0, TerritoryEndpoints.Invalid("page must be an integer >= 1"));
        }
        if (!string.IsNullOrEmpty(pageSize))
        {
            if (!int.TryParse(pageSize, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageSizeVal) || pageSizeVal < 1 || pageSizeVal > MaxPageSize)
                return (0, 0, TerritoryEndpoints.Invalid("pageSize must be between 1 and 200"));
        }
        return (pageVal, pageSizeVal, null);
    }
}
