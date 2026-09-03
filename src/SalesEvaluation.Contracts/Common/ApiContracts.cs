namespace SalesEvaluation.Contracts.Common;

/// <summary>
/// Normalized query period — the object Express handlers receive after zod's
/// normalizePeriodNumber (YEAR periods carry periodNumber 0).
/// </summary>
public class PeriodKeyDto
{
    /// <summary>"MONTH" | "QUARTER" | "YEAR".</summary>
    public string PeriodType { get; set; } = "MONTH";
    public int Year { get; set; }
    public int PeriodNumber { get; set; }
}

/// <summary>id + displayName + email summary — revision `changedBy` include.</summary>
public class UserSummaryDto
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
