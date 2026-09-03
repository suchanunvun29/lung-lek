namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Targets;

/// <summary>
/// Territory & Potential Rules ข้อ 5.2 — REBALANCE opens only when every unit present in the
/// region has a Target for this period; the payload carries what is missing per region name.
/// </summary>
public class RebalancePreconditionException : Exception
{
    public Dictionary<string, List<string>> MissingByRegionName { get; }

    public RebalancePreconditionException(Dictionary<string, List<string>> missingByRegionName)
        : base(BuildMessage(missingByRegionName))
    {
        MissingByRegionName = missingByRegionName;
    }

    private static string BuildMessage(Dictionary<string, List<string>> missingByRegionName)
    {
        var detail = string.Join(
            " · ",
            missingByRegionName.Select(entry => $"{entry.Key}: {string.Join(", ", entry.Value)}"));
        return $"โหมด REBALANCE เปิดใช้ได้เฉพาะเมื่อทุกเขตในภาคมีเป้าของงวดนั้นครบแล้ว — ยังขาด: {detail}";
    }
}

public interface ITargetAssistService
{
    /// <summary>
    /// Module L preview — GET /target-suggestions/:year/:month and the reinstate-deal variant.
    /// Nothing is ever written; the manager accepts numbers into Target through the target endpoints.
    /// </summary>
    Task<TargetSuggestionPreviewDto> BuildPreviewAsync(
        int year,
        int month,
        string mode,
        double? growthRateOverride,
        IReadOnlySet<string>? reinstatedInvoiceNos,
        CancellationToken cancellationToken = default);
}
