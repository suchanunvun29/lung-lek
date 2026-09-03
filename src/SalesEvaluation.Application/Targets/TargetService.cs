namespace SalesEvaluation.Application.Targets;

using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class TargetService : ITargetService
{
    private readonly IAppDbContext _dbContext;

    public TargetService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // Phase 12 XOR-3-way guard: every Target row must carry EXACTLY ONE owner key and it must
    // match its own `scope`. The monthly upsert below only ever writes SALESPERSON targets.
    private static void AssertTargetScopeXor(TargetScope scope, string? salespersonId, string? territoryId, string? territoryGroupId)
    {
        var filled = new[] { salespersonId, territoryId, territoryGroupId }.Count(id => !string.IsNullOrEmpty(id));
        var expectedKeyFilled = scope switch
        {
            TargetScope.SALESPERSON => !string.IsNullOrEmpty(salespersonId),
            TargetScope.TERRITORY => !string.IsNullOrEmpty(territoryId),
            TargetScope.TERRITORY_GROUP => !string.IsNullOrEmpty(territoryGroupId),
            _ => false
        };

        if (filled != 1 || !expectedKeyFilled)
        {
            throw new ValidationException("เป้าต้องอ้างอิงพนักงานขาย หรือเขต หรือกลุ่มเขต อย่างใดอย่างหนึ่งเท่านั้นและต้องตรงกับ scope");
        }
    }

    /// <summary>TargetRevision.before/after snapshot — plain numbers, product groups sorted by productTypeId.</summary>
    private static object ToTargetSnapshot(Target target)
    {
        return new
        {
            id = target.Id,
            salespersonId = target.SalespersonId,
            year = target.Year,
            month = target.Month,
            revenueTarget = (double)target.RevenueTarget,
            newCustomerTarget = target.NewCustomerTarget,
            note = target.Note,
            productGroupTargets = target.ProductGroupTargets
                .OrderBy(pg => pg.ProductTypeId, StringComparer.Ordinal)
                .Select(pg => new { productTypeId = pg.ProductTypeId, revenueTarget = (double)pg.RevenueTarget })
                .ToList()
        };
    }

    private static TargetDto MapTarget(Target target, bool includeSalesperson, bool includeProductType)
    {
        return new TargetDto
        {
            Id = target.Id,
            Scope = target.Scope.ToString(),
            TerritoryId = target.TerritoryId,
            TerritoryGroupId = target.TerritoryGroupId,
            SalespersonId = target.SalespersonId,
            Year = target.Year,
            Month = target.Month,
            RevenueTarget = target.RevenueTarget.ToString(CultureInfo.InvariantCulture),
            NewCustomerTarget = target.NewCustomerTarget,
            Note = target.Note,
            CreatedAt = target.CreatedAt,
            UpdatedAt = target.UpdatedAt,
            ProductGroupTargets = target.ProductGroupTargets
                .OrderBy(pg => pg.ProductTypeId, StringComparer.Ordinal)
                .Select(pg => new TargetProductGroupDto
                {
                    Id = pg.Id,
                    TargetId = pg.TargetId,
                    ProductTypeId = pg.ProductTypeId,
                    RevenueTarget = pg.RevenueTarget.ToString(CultureInfo.InvariantCulture),
                    ProductType = includeProductType && pg.ProductType != null
                        ? new ProductTypeSummaryDto { Id = pg.ProductType.Id, Name = pg.ProductType.Name }
                        : null
                })
                .ToList(),
            Salesperson = includeSalesperson && target.Salesperson != null
                ? new SalespersonSummaryDto { Id = target.Salesperson.Id, DisplayName = target.Salesperson.DisplayName }
                : null
        };
    }

    public async Task<TargetsResponse> ListTargetsAsync(int year, TargetScope scope, CancellationToken cancellationToken = default)
    {
        // Prisma orderBy: [{ salesperson: { displayName: "asc" } }, { month: "asc" }] — ordered in
        // SQL (same collation), salesperson null (TERRITORY/TERRITORY_GROUP scopes) sorts last.
        var targets = await _dbContext.Targets
            .AsNoTracking()
            .Include(t => t.Salesperson)
            .Include(t => t.ProductGroupTargets).ThenInclude(pg => pg.ProductType)
            .Where(t => t.Year == year && t.Scope == scope)
            .OrderBy(t => t.Salesperson != null ? t.Salesperson.DisplayName : null)
            .ThenBy(t => t.Month)
            .ToListAsync(cancellationToken);

        return new TargetsResponse
        {
            Targets = targets.Select(t => MapTarget(t, includeSalesperson: true, includeProductType: true)).ToList()
        };
    }

    public async Task<TargetResponse?> UpsertMonthlyTargetAsync(
        string salespersonId,
        int year,
        int month,
        UpsertTargetInput input,
        string changedById,
        CancellationToken cancellationToken = default)
    {
        AssertTargetScopeXor(TargetScope.SALESPERSON, salespersonId, null, null);

        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);
        if (salesperson == null)
        {
            return null;
        }

        var existing = await _dbContext.Targets
            .Include(t => t.ProductGroupTargets)
            .FirstOrDefaultAsync(t => t.SalespersonId == salespersonId && t.Year == year && t.Month == month, cancellationToken);

        Target target;
        if (existing == null)
        {
            target = new Target
            {
                Id = Guid.NewGuid().ToString(),
                SalespersonId = salespersonId,
                Scope = TargetScope.SALESPERSON,
                Year = year,
                Month = month,
                RevenueTarget = input.RevenueTarget,
                NewCustomerTarget = input.NewCustomerTarget,
                Note = input.Note ?? null
            };
            _dbContext.Targets.Add(target);

            _dbContext.TargetRevisions.Add(new TargetRevision
            {
                Id = Guid.NewGuid().ToString(),
                TargetId = target.Id,
                ChangeType = TargetChangeType.CREATE,
                Before = null,
                After = SnapshotJson.Serialize(ToTargetSnapshot(target)),
                ChangedById = changedById
            });
        }
        else
        {
            target = existing;
            var before = SnapshotJson.Serialize(ToTargetSnapshot(existing));

            existing.RevenueTarget = input.RevenueTarget;
            existing.NewCustomerTarget = input.NewCustomerTarget;
            if (input.HasNote)
            {
                existing.Note = input.Note;
            }

            existing.UpdatedAt = DateTime.UtcNow;

            _dbContext.TargetRevisions.Add(new TargetRevision
            {
                Id = Guid.NewGuid().ToString(),
                TargetId = existing.Id,
                ChangeType = TargetChangeType.UPDATE,
                Before = before,
                After = SnapshotJson.Serialize(ToTargetSnapshot(existing)),
                ChangedById = changedById
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TargetResponse { Target = MapTarget(target, includeSalesperson: false, includeProductType: false) };
    }

    // Scope-agnostic by design: keyed purely by targetId, so it serves SALESPERSON targets and
    // TERRITORY/TERRITORY_GROUP targets without any branching.
    public async Task<TargetResponse?> SetProductGroupTargetsAsync(
        string targetId,
        List<ProductGroupInputDto> productGroups,
        string changedById,
        CancellationToken cancellationToken = default)
    {
        var existing = await _dbContext.Targets
            .Include(t => t.ProductGroupTargets)
            .FirstOrDefaultAsync(t => t.Id == targetId, cancellationToken);
        if (existing == null)
        {
            return null;
        }

        var before = SnapshotJson.Serialize(ToTargetSnapshot(existing));

        _dbContext.TargetProductGroups.RemoveRange(existing.ProductGroupTargets);
        foreach (var pg in productGroups)
        {
            _dbContext.TargetProductGroups.Add(new TargetProductGroup
            {
                Id = Guid.NewGuid().ToString(),
                TargetId = targetId,
                ProductTypeId = pg.ProductTypeId,
                RevenueTarget = pg.RevenueTarget
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload so the snapshot and the response carry the fresh product-group rows.
        var updated = await _dbContext.Targets
            .AsNoTracking()
            .Include(t => t.ProductGroupTargets).ThenInclude(pg => pg.ProductType)
            .FirstAsync(t => t.Id == targetId, cancellationToken);

        _dbContext.TargetRevisions.Add(new TargetRevision
        {
            Id = Guid.NewGuid().ToString(),
            TargetId = targetId,
            ChangeType = TargetChangeType.UPDATE,
            Before = before,
            After = SnapshotJson.Serialize(ToTargetSnapshot(updated)),
            ChangedById = changedById
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TargetResponse { Target = MapTarget(updated, includeSalesperson: false, includeProductType: false) };
    }

    public async Task<CopyTargetsResult> CopyTargetsAsync(CopyTargetsInput input, string changedById, CancellationToken cancellationToken = default)
    {
        var sourceTargets = await _dbContext.Targets
            .AsNoTracking()
            .Include(t => t.ProductGroupTargets)
            .Where(t => t.Year == input.FromYear && t.Month == input.FromMonth && t.Scope == TargetScope.SALESPERSON)
            .ToListAsync(cancellationToken);

        var result = new CopyTargetsResult { SourceCount = sourceTargets.Count };
        var revisionNote = $"คัดลอกจากเป้าเดือน {input.FromMonth}/{input.FromYear}";

        foreach (var source in sourceTargets)
        {
            var salespersonId = source.SalespersonId;
            if (salespersonId == null)
            {
                continue;
            }

            var destination = await _dbContext.Targets
                .Include(t => t.ProductGroupTargets)
                .FirstOrDefaultAsync(t => t.SalespersonId == salespersonId && t.Year == input.ToYear && t.Month == input.ToMonth, cancellationToken);

            if (destination != null && !input.Overwrite)
            {
                result.Skipped.Add(salespersonId);
                continue;
            }

            if (destination == null)
            {
                AssertTargetScopeXor(TargetScope.SALESPERSON, salespersonId, null, null);
                var newTarget = new Target
                {
                    Id = Guid.NewGuid().ToString(),
                    SalespersonId = salespersonId,
                    Scope = TargetScope.SALESPERSON,
                    Year = input.ToYear,
                    Month = input.ToMonth,
                    RevenueTarget = source.RevenueTarget,
                    NewCustomerTarget = source.NewCustomerTarget,
                    Note = source.Note
                };
                foreach (var pg in source.ProductGroupTargets)
                {
                    newTarget.ProductGroupTargets.Add(new TargetProductGroup
                    {
                        Id = Guid.NewGuid().ToString(),
                        TargetId = newTarget.Id,
                        ProductTypeId = pg.ProductTypeId,
                        RevenueTarget = pg.RevenueTarget
                    });
                }

                _dbContext.Targets.Add(newTarget);
                _dbContext.TargetRevisions.Add(new TargetRevision
                {
                    Id = Guid.NewGuid().ToString(),
                    TargetId = newTarget.Id,
                    ChangeType = TargetChangeType.CREATE,
                    Before = null,
                    After = SnapshotJson.Serialize(ToTargetSnapshot(newTarget)),
                    ChangedById = changedById,
                    Note = revisionNote
                });
                result.Created.Add(salespersonId);
                continue;
            }

            var before = SnapshotJson.Serialize(ToTargetSnapshot(destination));
            _dbContext.TargetProductGroups.RemoveRange(destination.ProductGroupTargets);
            destination.RevenueTarget = source.RevenueTarget;
            destination.NewCustomerTarget = source.NewCustomerTarget;
            destination.Note = source.Note;
            foreach (var pg in source.ProductGroupTargets)
            {
                _dbContext.TargetProductGroups.Add(new TargetProductGroup
                {
                    Id = Guid.NewGuid().ToString(),
                    TargetId = destination.Id,
                    ProductTypeId = pg.ProductTypeId,
                    RevenueTarget = pg.RevenueTarget
                });
            }

            _dbContext.TargetRevisions.Add(new TargetRevision
            {
                Id = Guid.NewGuid().ToString(),
                TargetId = destination.Id,
                ChangeType = TargetChangeType.UPDATE,
                Before = before,
                After = SnapshotJson.Serialize(ToTargetSnapshot(destination)),
                ChangedById = changedById,
                Note = revisionNote
            });
            result.Updated.Add(salespersonId);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task<TargetRevisionsResponse?> GetTargetRevisionsAsync(string targetId, CancellationToken cancellationToken = default)
    {
        var target = await _dbContext.Targets
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == targetId, cancellationToken);
        if (target == null)
        {
            return null;
        }

        var revisions = await _dbContext.TargetRevisions
            .AsNoTracking()
            .Include(r => r.ChangedBy)
            .Where(r => r.TargetId == targetId)
            .OrderByDescending(r => r.ChangedAt)
            .ToListAsync(cancellationToken);

        return new TargetRevisionsResponse
        {
            Revisions = revisions.Select(r => new TargetRevisionDto
            {
                Id = r.Id,
                TargetId = r.TargetId,
                ChangeType = r.ChangeType.ToString(),
                Before = ParseSnapshot(r.Before),
                After = ParseSnapshot(r.After),
                ChangedById = r.ChangedById,
                ChangedBy = new UserSummaryDto { Id = r.ChangedBy.Id, DisplayName = r.ChangedBy.DisplayName, Email = r.ChangedBy.Email },
                ChangedAt = r.ChangedAt,
                Note = r.Note
            }).ToList()
        };
    }

    private static JsonElement? ParseSnapshot(string? json)
    {
        if (json == null)
        {
            return null;
        }

        return JsonDocument.Parse(json).RootElement.Clone();
    }

    public async Task<DerivedTargetResponse?> GetDerivedTargetAsync(string salespersonId, int year, int month, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .FirstOrDefaultAsync(sp => sp.Id == salespersonId, cancellationToken);
        if (salesperson == null)
        {
            return null;
        }

        var firstDay = PeriodUtils.FirstDayOfPeriod(new AppPeriodKey(PeriodType.MONTH, year, month));
        var lastDay = PeriodUtils.LastDayOfPeriod(new AppPeriodKey(PeriodType.MONTH, year, month));

        var personal = await _dbContext.Targets
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.SalespersonId == salespersonId && t.Year == year && t.Month == month, cancellationToken);
        if (personal?.Scope == TargetScope.SALESPERSON)
        {
            return new DerivedTargetResponse
            {
                DerivedTarget = new DerivedTargetDto
                {
                    RevenueTarget = (double)personal.RevenueTarget,
                    NewCustomerTarget = personal.NewCustomerTarget,
                    Source = "MANUAL",
                    Items = new List<DerivedTargetContributionDto>()
                }
            };
        }

        var assignments = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Territory).ThenInclude(t => t.GroupMemberships)
            .Where(a => a.SalespersonId == salespersonId && a.EffectiveFrom <= lastDay && (a.EffectiveTo == null || a.EffectiveTo >= firstDay))
            .ToListAsync(cancellationToken);

        var territoryIds = assignments.Select(a => a.TerritoryId).ToList();
        var groupIds = assignments
            .SelectMany(a => a.Territory.GroupMemberships)
            .Where(m => m.EffectiveFrom <= lastDay && (m.EffectiveTo == null || m.EffectiveTo >= firstDay))
            .Select(m => m.GroupId)
            .Distinct()
            .ToList();

        var targets = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.Year == year && t.Month == month &&
                        ((t.Scope == TargetScope.TERRITORY && t.TerritoryId != null && territoryIds.Contains(t.TerritoryId)) ||
                         (t.Scope == TargetScope.TERRITORY_GROUP && t.TerritoryGroupId != null && groupIds.Contains(t.TerritoryGroupId))))
            .ToListAsync(cancellationToken);

        var assignmentRows = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Where(a => a.EffectiveFrom <= lastDay && (a.EffectiveTo == null || a.EffectiveTo >= firstDay) && territoryIds.Contains(a.TerritoryId))
            .Select(a => new { a.TerritoryId, a.SalespersonId })
            .ToListAsync(cancellationToken);

        var ownersByTerritory = new Dictionary<string, HashSet<string>>();
        foreach (var row in assignmentRows)
        {
            if (!ownersByTerritory.TryGetValue(row.TerritoryId, out var owners))
            {
                owners = new HashSet<string>();
                ownersByTerritory[row.TerritoryId] = owners;
            }

            owners.Add(row.SalespersonId);
        }

        var items = new List<DerivedTargetContributionDto>();
        double revenueTarget = 0;
        double newCustomerTarget = 0;

        foreach (var target in targets)
        {
            if (target.Scope == TargetScope.TERRITORY && target.TerritoryId != null)
            {
                var owners = ownersByTerritory.GetValueOrDefault(target.TerritoryId) ?? new HashSet<string>();
                if (owners.Count == 0)
                {
                    items.Add(new DerivedTargetContributionDto
                    {
                        TerritoryId = target.TerritoryId,
                        Unassigned = true,
                        RevenueTarget = (double)target.RevenueTarget
                    });
                    continue;
                }

                revenueTarget += (double)target.RevenueTarget / owners.Count;
                newCustomerTarget += target.NewCustomerTarget / (double)owners.Count;
                items.Add(new DerivedTargetContributionDto
                {
                    TerritoryId = target.TerritoryId,
                    RevenueTarget = (double)target.RevenueTarget / owners.Count
                });
            }

            if (target.Scope == TargetScope.TERRITORY_GROUP && target.TerritoryGroupId != null)
            {
                // activeOwnerCount(G) spans every period-active member territory of G, deduped by
                // person — never just the caller's own territories (Territory KPI Rules ข้อ 6 extension).
                var members = await _dbContext.TerritoryGroupMembers
                    .AsNoTracking()
                    .Where(m => m.GroupId == target.TerritoryGroupId && m.EffectiveFrom <= lastDay && (m.EffectiveTo == null || m.EffectiveTo >= firstDay))
                    .Select(m => m.TerritoryId)
                    .ToListAsync(cancellationToken);

                var ownerRows = await _dbContext.TerritoryAssignments
                    .AsNoTracking()
                    .Where(a => a.EffectiveFrom <= lastDay && (a.EffectiveTo == null || a.EffectiveTo >= firstDay) && members.Contains(a.TerritoryId))
                    .Select(a => a.SalespersonId)
                    .ToListAsync(cancellationToken);

                var owners = ownerRows.ToHashSet();
                if (owners.Count == 0)
                {
                    items.Add(new DerivedTargetContributionDto
                    {
                        TerritoryGroupId = target.TerritoryGroupId,
                        Unassigned = true,
                        RevenueTarget = (double)target.RevenueTarget
                    });
                    continue;
                }

                revenueTarget += (double)target.RevenueTarget / owners.Count;
                newCustomerTarget += target.NewCustomerTarget / (double)owners.Count;
                items.Add(new DerivedTargetContributionDto
                {
                    TerritoryGroupId = target.TerritoryGroupId,
                    RevenueTarget = (double)target.RevenueTarget / owners.Count
                });
            }
        }

        return new DerivedTargetResponse
        {
            DerivedTarget = new DerivedTargetDto
            {
                RevenueTarget = revenueTarget,
                NewCustomerTarget = newCustomerTarget,
                Source = groupIds.Count > 0 ? "TERRITORY_GROUP" : "TERRITORY",
                Items = items
            }
        };
    }
}
