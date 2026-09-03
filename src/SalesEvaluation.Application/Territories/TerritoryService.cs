namespace SalesEvaluation.Application.Territories;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Territories;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class TerritoryService : ITerritoryService
{
    private readonly IAppDbContext _dbContext;

    public TerritoryService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // ---- Territories ----

    public async Task<TerritoriesResponse> ListTerritoriesAsync(CancellationToken cancellationToken = default)
    {
        // activeOwnerCount mirrors the TS filter `OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }]`
        // against `new Date()`: a DATE row closed today is already inactive — hence `> today`.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var territories = await _dbContext.Territories
            .AsNoTracking()
            .Include(t => t.Region)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToListAsync(cancellationToken);

        var assignmentRows = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Select(a => new { a.TerritoryId, a.EffectiveTo })
            .ToListAsync(cancellationToken);
        var assignmentCounts = assignmentRows
            .GroupBy(a => a.TerritoryId)
            .ToDictionary(g => g.Key, g => g.Count(a => a.EffectiveTo == null || a.EffectiveTo > today));

        var hospitalRows = await _dbContext.Hospitals
            .AsNoTracking()
            .Where(h => h.TerritoryId != null)
            .Select(h => h.TerritoryId!.Value)
            .ToListAsync(cancellationToken);
        var hospitalCounts = hospitalRows
            .GroupBy(id => id)
            .ToDictionary(g => g.Key, g => g.Count());

        return new TerritoriesResponse
        {
            Territories = territories.Select(t => MapTerritory(t, assignmentCounts.GetValueOrDefault(t.Id), hospitalCounts.GetValueOrDefault(t.Id))).ToList()
        };
    }

    public async Task<TerritoryResponse> CreateTerritoryAsync(CreateTerritoryRequest request, CancellationToken cancellationToken = default)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            throw new ValidationException("Validation failed", "name must not be empty");
        }

        if (request.RegionId.HasValue &&
            !await _dbContext.Regions.AnyAsync(r => r.Id == request.RegionId.Value, cancellationToken))
        {
            throw new NotFoundException("Region not found");
        }

        var territory = new Territory
        {
            Name = name,
            Code = request.Code,
            RegionId = request.RegionId,
            SortOrder = request.SortOrder ?? 0,
            IsActive = request.IsActive ?? true,
            Note = request.Note,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Territories.Add(territory);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // The TypeScript create does not include the region relation — it stays null in the response.
        return new TerritoryResponse { Territory = MapTerritory(territory, 0, 0) };
    }

    public async Task<TerritoryResponse> UpdateTerritoryAsync(int id, UpdateTerritoryRequest request, CancellationToken cancellationToken = default)
    {
        var territory = await _dbContext.Territories
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (territory == null)
        {
            throw new NotFoundException("Territory not found");
        }

        if (!request.HasAnyField)
        {
            throw new ValidationException("Validation failed", "ต้องระบุข้อมูลที่ต้องการแก้ไข");
        }

        if (request.HasRegionId && request.RegionId.HasValue &&
            !await _dbContext.Regions.AnyAsync(r => r.Id == request.RegionId.Value, cancellationToken))
        {
            throw new NotFoundException("Region not found");
        }

        if (request.HasName)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ValidationException("Validation failed", "name must not be empty");
            }
            territory.Name = request.Name.Trim();
        }

        if (request.HasCode)
        {
            territory.Code = request.Code;
        }

        if (request.HasRegionId)
        {
            territory.RegionId = request.RegionId;
        }

        if (request.HasSortOrder && request.SortOrder.HasValue)
        {
            territory.SortOrder = request.SortOrder.Value;
        }

        if (request.HasIsActive && request.IsActive.HasValue)
        {
            territory.IsActive = request.IsActive.Value;
        }

        if (request.HasNote)
        {
            territory.Note = request.Note;
        }

        territory.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        // The TypeScript update does not include the region relation — it stays null in the response.
        return new TerritoryResponse { Territory = MapTerritory(territory, 0, 0) };
    }

    private static TerritoryDto MapTerritory(Territory territory, int activeOwnerCount, int hospitalCount)
    {
        return new TerritoryDto
        {
            Id = territory.Id,
            Name = territory.Name,
            Code = territory.Code,
            RegionId = territory.RegionId,
            Region = territory.Region == null
                ? null
                : new RegionSummaryDto { Id = territory.Region.Id, Name = territory.Region.Name },
            SortOrder = territory.SortOrder,
            IsActive = territory.IsActive,
            Note = territory.Note,
            CreatedAt = territory.CreatedAt,
            UpdatedAt = territory.UpdatedAt,
            ActiveOwnerCount = activeOwnerCount,
            HospitalCount = hospitalCount
        };
    }

    // ---- Assignments ----

    public async Task<TerritoryAssignmentsResponse> ListAssignmentsAsync(int? territoryId, int? salespersonId, string? status, CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var query = _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Territory)
            .Include(a => a.Salesperson)
            .Include(a => a.AssignedBy)
            .AsQueryable();

        if (territoryId.HasValue)
        {
            query = query.Where(a => a.TerritoryId == territoryId.Value);
        }

        if (salespersonId.HasValue)
        {
            query = query.Where(a => a.SalespersonId == salespersonId.Value);
        }

        if (status == "ACTIVE")
        {
            query = query.Where(a => a.EffectiveTo == null || a.EffectiveTo > today);
        }
        else if (status == "INACTIVE")
        {
            query = query.Where(a => a.EffectiveTo != null && a.EffectiveTo <= today);
        }

        var assignments = await query
            .OrderByDescending(a => a.EffectiveFrom)
            .ToListAsync(cancellationToken);

        return new TerritoryAssignmentsResponse
        {
            TerritoryAssignments = assignments.Select(MapAssignment).ToList()
        };
    }

    public async Task<(TerritoryAssignmentDto Assignment, bool Created)> PutAssignmentAsync(PutAssignmentRequest request, int assignedById, CancellationToken cancellationToken = default)
    {
        if (request.HasEffectiveFrom && request.HasEffectiveTo)
        {
            throw new ValidationException("Validation failed", "ห้ามส่ง effectiveFrom และ effectiveTo พร้อมกัน");
        }

        if (!request.HasEffectiveFrom && !request.HasEffectiveTo)
        {
            throw new ValidationException("Validation failed", "ต้องระบุ effectiveFrom หรือ effectiveTo");
        }

        if (request.HasEffectiveTo)
        {
            var closed = await WithdrawAssignmentAsync(request, cancellationToken);
            return (closed, Created: false);
        }

        var created = await AssignTerritoryAsync(request, assignedById, cancellationToken);
        return (created, Created: true);
    }

    private async Task<TerritoryAssignmentDto> WithdrawAssignmentAsync(PutAssignmentRequest request, CancellationToken cancellationToken)
    {
        var effectiveTo = request.EffectiveTo!.Value;

        var openRows = await _dbContext.TerritoryAssignments
            .Include(a => a.Territory)
            .Include(a => a.Salesperson)
            .Include(a => a.AssignedBy)
            .Where(a => a.TerritoryId == request.TerritoryId && a.SalespersonId == request.SalespersonId && a.EffectiveTo == null)
            .OrderByDescending(a => a.EffectiveFrom)
            .ToListAsync(cancellationToken);

        if (openRows.Count == 0)
        {
            throw new NotFoundException("Territory assignment not found");
        }

        var earliestOpenFrom = openRows[^1].EffectiveFrom;
        if (effectiveTo < earliestOpenFrom)
        {
            throw new ValidationException("effectiveTo ต้องไม่ก่อน effectiveFrom");
        }

        foreach (var row in openRows)
        {
            row.EffectiveTo = effectiveTo;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapAssignment(openRows[0]);
    }

    private async Task<TerritoryAssignmentDto> AssignTerritoryAsync(PutAssignmentRequest request, int assignedById, CancellationToken cancellationToken)
    {
        var effectiveFrom = request.EffectiveFrom!.Value;

        if (!await _dbContext.Territories.AnyAsync(t => t.Id == request.TerritoryId, cancellationToken))
        {
            throw new NotFoundException("Territory not found");
        }

        if (!await _dbContext.Salespeople.AnyAsync(sp => sp.Id == request.SalespersonId, cancellationToken))
        {
            throw new NotFoundException("Salesperson not found");
        }

        // Territory KPI Rules ข้อ 6.2 — an effectiveFrom at/before the earliest open row would make
        // the day-before close precede that row's own start (inverted range) — reject before writing.
        var earliestOpenFrom = await _dbContext.TerritoryAssignments
            .Where(a => a.TerritoryId == request.TerritoryId && a.SalespersonId == request.SalespersonId && a.EffectiveTo == null)
            .OrderBy(a => a.EffectiveFrom)
            .Select(a => (DateOnly?)a.EffectiveFrom)
            .FirstOrDefaultAsync(cancellationToken);

        if (earliestOpenFrom.HasValue && effectiveFrom <= earliestOpenFrom.Value)
        {
            throw new ValidationException(
                "Validation failed",
                $"effectiveFrom ต้องไม่เร็วกว่าหรือเท่ากับ effectiveFrom ของแถวที่ยังเปิดอยู่ ({effectiveFrom:yyyy-MM-dd} ≤ {earliestOpenFrom.Value:yyyy-MM-dd})");
        }

        var openRows = await _dbContext.TerritoryAssignments
            .Where(a => a.TerritoryId == request.TerritoryId && a.SalespersonId == request.SalespersonId && a.EffectiveTo == null)
            .ToListAsync(cancellationToken);

        var dayBefore = effectiveFrom.AddDays(-1);
        foreach (var row in openRows)
        {
            row.EffectiveTo = dayBefore;
        }

        var assignment = new TerritoryAssignment
        {
            TerritoryId = request.TerritoryId,
            SalespersonId = request.SalespersonId,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = null,
            IsSupervisor = request.IsSupervisor ?? false,
            Note = request.Note,
            AssignedById = assignedById,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TerritoryAssignments.Add(assignment);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Prisma P2002/P2004 equivalent: unique (territoryId, salespersonId, effectiveFrom) violation.
            throw new ConflictException(
                $"พนักงานขายนี้มีรายการมอบหมายเขตที่มีผลตั้งแต่วันที่ {effectiveFrom:yyyy-MM-dd} อยู่แล้ว");
        }

        var saved = await _dbContext.TerritoryAssignments
            .AsNoTracking()
            .Include(a => a.Territory)
            .Include(a => a.Salesperson)
            .Include(a => a.AssignedBy)
            .FirstAsync(a => a.Id == assignment.Id, cancellationToken);

        return MapAssignment(saved);
    }

    private static TerritoryAssignmentDto MapAssignment(TerritoryAssignment assignment)
    {
        return new TerritoryAssignmentDto
        {
            Id = assignment.Id,
            TerritoryId = assignment.TerritoryId,
            Territory = new TerritoryRefDto { Id = assignment.Territory.Id, Name = assignment.Territory.Name },
            SalespersonId = assignment.SalespersonId,
            Salesperson = new UserSummaryDto { Id = assignment.Salesperson.Id, DisplayName = assignment.Salesperson.DisplayName },
            IsSupervisor = assignment.IsSupervisor,
            EffectiveFrom = ToUtcDateTime(assignment.EffectiveFrom),
            EffectiveTo = assignment.EffectiveTo == null ? null : ToUtcDateTime(assignment.EffectiveTo.Value),
            AssignedById = assignment.AssignedById,
            AssignedBy = assignment.AssignedBy == null
                ? null
                : new UserSummaryDto { Id = assignment.AssignedBy.Id, DisplayName = assignment.AssignedBy.DisplayName },
            Note = assignment.Note,
            CreatedAt = assignment.CreatedAt
        };
    }

    private static DateTime ToUtcDateTime(DateOnly date) => DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

    // ---- Territory groups ----

    public async Task<TerritoryGroupsResponse> ListGroupsAsync(CancellationToken cancellationToken = default)
    {
        var groups = await _dbContext.TerritoryGroups
            .AsNoTracking()
            .Include(g => g.Members)
            .ThenInclude(m => m.Territory)
            .OrderBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return new TerritoryGroupsResponse
        {
            TerritoryGroups = groups.Select(MapGroup).ToList()
        };
    }

    public async Task<TerritoryGroupResponse> CreateGroupAsync(CreateTerritoryGroupRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ValidationException("Validation failed", "name must not be empty");
        }

        var group = new TerritoryGroup
        {
            Name = request.Name.Trim(),
            IsActive = request.IsActive ?? true,
            Note = request.Note,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.TerritoryGroups.Add(group);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TerritoryGroupResponse { TerritoryGroup = MapGroup(group) };
    }

    public async Task<TerritoryGroupResponse> UpdateGroupAsync(int id, UpdateTerritoryGroupRequest request, CancellationToken cancellationToken = default)
    {
        var group = await _dbContext.TerritoryGroups
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);

        if (group == null)
        {
            throw new NotFoundException("Territory group not found");
        }

        if (!request.HasAnyField)
        {
            throw new ValidationException("Validation failed", "ต้องระบุข้อมูลที่ต้องการแก้ไข");
        }

        if (request.HasName)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ValidationException("Validation failed", "name must not be empty");
            }
            group.Name = request.Name.Trim();
        }

        if (request.HasIsActive && request.IsActive.HasValue)
        {
            group.IsActive = request.IsActive.Value;
        }

        if (request.HasNote)
        {
            group.Note = request.Note;
        }

        group.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TerritoryGroupResponse { TerritoryGroup = MapGroup(group) };
    }

    public async Task<TerritoryGroupMemberDto?> AddGroupMemberAsync(int groupId, AddGroupMemberRequest request, CancellationToken cancellationToken = default)
    {
        var period = new MembershipPeriod(request.EffectiveFrom, request.HasEffectiveTo ? request.EffectiveTo : null);

        var group = await _dbContext.TerritoryGroups
            .FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken);

        if (group == null)
        {
            return null;
        }

        await EnsureMembershipDoesNotOverlapAsync(request.TerritoryId, period, excludedMemberId: null, cancellationToken);
        await EnsureMembershipHasNoTerritoryTargetsAsync(request.TerritoryId, period, cancellationToken);

        var member = new TerritoryGroupMember
        {
            GroupId = groupId,
            TerritoryId = request.TerritoryId,
            EffectiveFrom = period.EffectiveFrom,
            EffectiveTo = period.EffectiveTo,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TerritoryGroupMembers.Add(member);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Prisma P2004/P2010 equivalent: daterange exclusion constraint on (effectiveFrom, effectiveTo).
            throw new ConflictException($"เขต {request.TerritoryId} มีช่วงสมาชิกกลุ่มที่ทับกันกับ {FormatPeriod(period)}");
        }

        var saved = await _dbContext.TerritoryGroupMembers
            .AsNoTracking()
            .Include(m => m.Territory)
            .FirstAsync(m => m.Id == member.Id, cancellationToken);
        return MapMember(saved);
    }

    public async Task<TerritoryGroupMemberDto> UpdateGroupMemberAsync(int groupId, int memberId, UpdateGroupMemberRequest request, CancellationToken cancellationToken = default)
    {
        var member = await _dbContext.TerritoryGroupMembers
            .Include(m => m.Territory)
            .FirstOrDefaultAsync(m => m.Id == memberId && m.GroupId == groupId, cancellationToken);

        if (member == null)
        {
            throw new NotFoundException("Territory group member not found");
        }

        var effectiveFrom = request.HasEffectiveFrom ? request.EffectiveFrom!.Value : member.EffectiveFrom;
        var effectiveTo = request.HasEffectiveTo ? request.EffectiveTo : member.EffectiveTo;

        if (effectiveTo.HasValue && effectiveTo.Value < effectiveFrom)
        {
            throw new ConflictException("effectiveTo ต้องไม่ก่อน effectiveFrom");
        }

        var period = new MembershipPeriod(effectiveFrom, effectiveTo);

        await EnsureMembershipDoesNotOverlapAsync(member.TerritoryId, period, excludedMemberId: member.Id, cancellationToken);
        await EnsureMembershipHasNoTerritoryTargetsAsync(member.TerritoryId, period, cancellationToken);

        member.EffectiveFrom = period.EffectiveFrom;
        member.EffectiveTo = period.EffectiveTo;

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException($"เขต {member.TerritoryId} มีช่วงสมาชิกกลุ่มที่ทับกันกับ {FormatPeriod(period)}");
        }

        return MapMember(member);
    }

    private sealed record MembershipPeriod(DateOnly EffectiveFrom, DateOnly? EffectiveTo);

    private static string FormatPeriod(MembershipPeriod period) =>
        $"{period.EffectiveFrom:yyyy-MM-dd} ถึง {(period.EffectiveTo?.ToString("yyyy-MM-dd") ?? "ไม่มีกำหนด")}";

    private async Task EnsureMembershipDoesNotOverlapAsync(int territoryId, MembershipPeriod period, int? excludedMemberId, CancellationToken cancellationToken)
    {
        var effectiveToUpper = period.EffectiveTo ?? DateOnly.MaxValue;

        var overlapping = await _dbContext.TerritoryGroupMembers
            .Where(m => m.TerritoryId == territoryId &&
                        m.EffectiveFrom <= effectiveToUpper &&
                        (m.EffectiveTo == null || m.EffectiveTo >= period.EffectiveFrom))
            .Select(m => new { m.Id })
            .ToListAsync(cancellationToken);

        if (overlapping.Any(m => m.Id != excludedMemberId))
        {
            throw new ConflictException($"เขต {territoryId} เป็นสมาชิกของกลุ่มเขตอื่นในช่วง {FormatPeriod(period)} ที่ทับกัน");
        }
    }

    private async Task EnsureMembershipHasNoTerritoryTargetsAsync(int territoryId, MembershipPeriod period, CancellationToken cancellationToken)
    {
        var effectiveToUpper = period.EffectiveTo ?? DateOnly.MaxValue;

        var targets = await _dbContext.Targets
            .AsNoTracking()
            .Where(t => t.Scope == TargetScope.TERRITORY && t.TerritoryId == territoryId)
            .Select(t => new { t.Year, t.Month })
            .ToListAsync(cancellationToken);

        var conflictingTarget = targets
            .OrderBy(t => t.Year)
            .ThenBy(t => t.Month)
            .FirstOrDefault(t =>
                new DateOnly(t.Year, t.Month, 1) <= effectiveToUpper &&
                new DateOnly(t.Year, t.Month, DateTime.DaysInMonth(t.Year, t.Month)) >= period.EffectiveFrom);

        if (conflictingTarget != null)
        {
            throw new ConflictException($"เขตนี้มีเป้ารายเขตในงวด {conflictingTarget.Year}-{conflictingTarget.Month:D2} ซึ่งชนกับช่วงสมาชิกกลุ่ม");
        }
    }

    private static TerritoryGroupDto MapGroup(TerritoryGroup group)
    {
        return new TerritoryGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            IsActive = group.IsActive,
            Note = group.Note,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt,
            Members = group.Members
                .OrderByDescending(m => m.EffectiveFrom)
                .Select(MapMember)
                .ToList()
        };
    }

    private static TerritoryGroupMemberDto MapMember(TerritoryGroupMember member)
    {
        return new TerritoryGroupMemberDto
        {
            Id = member.Id,
            GroupId = member.GroupId,
            TerritoryId = member.TerritoryId,
            Territory = new TerritoryRefDto { Id = member.Territory.Id, Name = member.Territory.Name },
            EffectiveFrom = ToUtcDateTime(member.EffectiveFrom),
            EffectiveTo = member.EffectiveTo == null ? null : ToUtcDateTime(member.EffectiveTo.Value),
            CreatedAt = member.CreatedAt
        };
    }
}
