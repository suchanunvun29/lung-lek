namespace SalesEvaluation.Application.Territories;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class TerritoryScopeResolver : ITerritoryScopeResolver
{
    private readonly IAppDbContext _dbContext;

    public TerritoryScopeResolver(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // TerritoryAssignment dates are DATE columns (midnight). The TypeScript backend compares them
    // against `new Date()` (now), so a row closed today is already inactive later that day:
    // active ⇔ effectiveFrom <= today && (effectiveTo == null || effectiveTo > today).
    public static bool IsActiveToday(TerritoryAssignment assignment, DateOnly today) =>
        assignment.EffectiveFrom <= today &&
        (assignment.EffectiveTo == null || assignment.EffectiveTo > today);

    public async Task<ViewerTerritoryScope> ResolveViewerTerritoryScopeAsync(CurrentUserRef user, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.UserId == user.Id, cancellationToken);

        if (user.Role == UserRole.MANAGER)
        {
            return new ViewerTerritoryScope
            {
                CanSeeAllTerritories = true,
                SelfSalespersonId = salesperson?.Id,
                SupervisedTerritoryIds = new List<string>(),
                MemberTerritoryIds = new List<string>()
            };
        }

        if (salesperson == null)
        {
            return new ViewerTerritoryScope
            {
                CanSeeAllTerritories = false,
                SelfSalespersonId = null,
                SupervisedTerritoryIds = new List<string>(),
                MemberTerritoryIds = new List<string>()
            };
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Where(a => a.SalespersonId == salesperson.Id)
            .ToListAsync(cancellationToken);

        var activeRows = rows.Where(a => IsActiveToday(a, today)).ToList();

        return new ViewerTerritoryScope
        {
            CanSeeAllTerritories = false,
            SelfSalespersonId = salesperson.Id,
            SupervisedTerritoryIds = activeRows.Where(a => a.IsSupervisor).Select(a => a.TerritoryId).ToList(),
            MemberTerritoryIds = activeRows.Select(a => a.TerritoryId).ToList()
        };
    }

    public async Task<List<string>?> VisibleSalespersonIdsAsync(ViewerTerritoryScope scope, CancellationToken cancellationToken = default)
    {
        if (scope.CanSeeAllTerritories)
        {
            return null;
        }

        var ids = new List<string>();
        if (scope.SelfSalespersonId != null)
        {
            ids.Add(scope.SelfSalespersonId);
        }

        if (scope.SupervisedTerritoryIds.Count > 0)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var assigned = await _dbContext.TerritoryAssignments
                .AsNoTracking()
                .Where(a => scope.SupervisedTerritoryIds.Contains(a.TerritoryId))
                .ToListAsync(cancellationToken);

            ids.AddRange(
                assigned.Where(a => IsActiveToday(a, today))
                    .Select(a => a.SalespersonId));
        }

        return ids.Distinct().Where(id => !string.IsNullOrEmpty(id)).ToList();
    }

    public async Task<bool> CanViewSalespersonAsync(CurrentUserRef user, string salespersonId, CancellationToken cancellationToken = default)
    {
        var scope = await ResolveViewerTerritoryScopeAsync(user, cancellationToken);
        var ids = await VisibleSalespersonIdsAsync(scope, cancellationToken);
        return ids == null || ids.Contains(salespersonId);
    }

    public async Task<HashSet<string>?> ResolveViewerTerritoryIdsAsync(CurrentUserRef user, CancellationToken cancellationToken = default)
    {
        var scope = await ResolveViewerTerritoryScopeAsync(user, cancellationToken);
        if (scope.CanSeeAllTerritories)
        {
            return null;
        }

        return new HashSet<string>(scope.MemberTerritoryIds.Concat(scope.SupervisedTerritoryIds));
    }
}
