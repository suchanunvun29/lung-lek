namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;

public record UpsertTargetInput(decimal RevenueTarget, int NewCustomerTarget, string? Note, bool HasNote);

public record CopyTargetsInput(int FromYear, int FromMonth, int ToYear, int ToMonth, bool Overwrite);

public interface ITargetService
{
    /// <summary>GET /targets — include salesperson summary + product-group targets with product type.</summary>
    Task<TargetsResponse> ListTargetsAsync(int year, TargetScope scope, CancellationToken cancellationToken = default);

    /// <summary>PUT /targets/:salespersonId/:year/:month — upsert + TargetRevision snapshot. Returns null when the salesperson does not exist.</summary>
    Task<TargetResponse?> UpsertMonthlyTargetAsync(string salespersonId, int year, int month, UpsertTargetInput input, string changedById, CancellationToken cancellationToken = default);

    /// <summary>PUT /targets/:targetId/product-groups — replace the product-group rows + revision snapshot. Returns null when the target does not exist.</summary>
    Task<TargetResponse?> SetProductGroupTargetsAsync(string targetId, List<ProductGroupInputDto> productGroups, string changedById, CancellationToken cancellationToken = default);

    /// <summary>POST /targets/copy — copy a month's SALESPERSON targets onto another month.</summary>
    Task<CopyTargetsResult> CopyTargetsAsync(CopyTargetsInput input, string changedById, CancellationToken cancellationToken = default);

    /// <summary>GET /targets/:targetId/revisions — newest first, with changedBy. Returns null when the target does not exist.</summary>
    Task<TargetRevisionsResponse?> GetTargetRevisionsAsync(string targetId, CancellationToken cancellationToken = default);

    /// <summary>GET /targets/derived/:salespersonId/:year/:month. Returns null when the salesperson does not exist.</summary>
    Task<DerivedTargetResponse?> GetDerivedTargetAsync(string salespersonId, int year, int month, CancellationToken cancellationToken = default);
}
