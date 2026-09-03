namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Domain.Enums;

public class ViewerTerritoryScope
{
    public bool CanSeeAllTerritories { get; init; }
    public string? SelfSalespersonId { get; init; }
    public List<string> SupervisedTerritoryIds { get; init; } = new();
    public List<string> MemberTerritoryIds { get; init; } = new();
}

public class CurrentUserRef
{
    public string Id { get; init; } = string.Empty;
    public UserRole Role { get; init; }
}

/// <summary>
/// The ONE viewer→territory resolution in the system (Data Visibility Rules ข้อ 2).
/// Rights are evaluated "as of today" (never per viewed period): an assignment counts while
/// `effectiveFrom <= today` and `effectiveTo` is null or beyond today.
/// </summary>
public interface ITerritoryScopeResolver
{
    Task<ViewerTerritoryScope> ResolveViewerTerritoryScopeAsync(CurrentUserRef user, CancellationToken cancellationToken = default);

    /// <summary>Salesperson ids the viewer may see; null = sees everyone (MANAGER).</summary>
    Task<List<string>?> VisibleSalespersonIdsAsync(ViewerTerritoryScope scope, CancellationToken cancellationToken = default);

    Task<bool> CanViewSalespersonAsync(CurrentUserRef user, string salespersonId, CancellationToken cancellationToken = default);

    /// <summary>Territories the viewer sees TERRITORY_FULL on; null = MANAGER (all territories).</summary>
    Task<HashSet<string>?> ResolveViewerTerritoryIdsAsync(CurrentUserRef user, CancellationToken cancellationToken = default);
}
