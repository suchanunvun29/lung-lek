namespace SalesEvaluation.Contracts.Territories;

public class RegionSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Raw Territory row as returned by the TypeScript backend (its display field is `name`).
/// `activeOwnerCount` counts assignments not yet closed as of now; `hospitalCount` all linked hospitals.
/// </summary>
public class TerritoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? RegionId { get; set; }
    public RegionSummaryDto? Region { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int ActiveOwnerCount { get; set; }
    public int HospitalCount { get; set; }
}

public class TerritoriesResponse
{
    public List<TerritoryDto> Territories { get; set; } = new();
}

public class TerritoryResponse
{
    public TerritoryDto Territory { get; set; } = null!;
}

public class CreateTerritoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? RegionId { get; set; }
    public bool HasRegionId { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
    public string? Note { get; set; }
}

/// <summary>PATCH body — every property is optional; Has-flags separate "absent" from "explicit null".</summary>
public class UpdateTerritoryRequest
{
    public string? Name { get; set; }
    public bool HasName { get; set; }
    public string? Code { get; set; }
    public bool HasCode { get; set; }
    public int? RegionId { get; set; }
    public bool HasRegionId { get; set; }
    public int? SortOrder { get; set; }
    public bool HasSortOrder { get; set; }
    public bool? IsActive { get; set; }
    public bool HasIsActive { get; set; }
    public string? Note { get; set; }
    public bool HasNote { get; set; }

    public bool HasAnyField =>
        HasName || HasCode || HasRegionId || HasSortOrder || HasIsActive || HasNote;
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public class TerritoryRefDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class TerritoryAssignmentDto
{
    public int Id { get; set; }
    public int TerritoryId { get; set; }
    public TerritoryRefDto Territory { get; set; } = null!;
    public int SalespersonId { get; set; }
    public UserSummaryDto Salesperson { get; set; } = null!;
    public bool IsSupervisor { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public int? AssignedById { get; set; }
    public UserSummaryDto? AssignedBy { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TerritoryAssignmentsResponse
{
    public List<TerritoryAssignmentDto> TerritoryAssignments { get; set; } = new();
}

public class AssignmentResponse
{
    public TerritoryAssignmentDto Assignment { get; set; } = null!;
}

/// <summary>
/// PUT /territory-assignments body — one shape for both operations:
/// effectiveFrom present = assign a new period; effectiveTo present = withdraw (close the open row).
/// Sending both (or neither) is a validation error, per the fixed frontend contract.
/// </summary>
public class PutAssignmentRequest
{
    public int TerritoryId { get; set; }
    public int SalespersonId { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public bool HasEffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool HasEffectiveTo { get; set; }
    public bool? IsSupervisor { get; set; }
    public string? Note { get; set; }
    public bool HasNote { get; set; }
}

public class TerritoryGroupMemberDto
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public int TerritoryId { get; set; }
    public TerritoryRefDto Territory { get; set; } = null!;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TerritoryGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<TerritoryGroupMemberDto> Members { get; set; } = new();
}

public class TerritoryGroupsResponse
{
    public List<TerritoryGroupDto> TerritoryGroups { get; set; } = new();
}

public class TerritoryGroupResponse
{
    public TerritoryGroupDto TerritoryGroup { get; set; } = null!;
}

public class CreateTerritoryGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public bool? IsActive { get; set; }
    public string? Note { get; set; }
    public bool HasNote { get; set; }
}

public class UpdateTerritoryGroupRequest
{
    public string? Name { get; set; }
    public bool HasName { get; set; }
    public bool? IsActive { get; set; }
    public bool HasIsActive { get; set; }
    public string? Note { get; set; }
    public bool HasNote { get; set; }

    public bool HasAnyField => HasName || HasIsActive || HasNote;
}

public class AddGroupMemberRequest
{
    public int TerritoryId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool HasEffectiveTo { get; set; }
}

public class UpdateGroupMemberRequest
{
    public DateOnly? EffectiveFrom { get; set; }
    public bool HasEffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool HasEffectiveTo { get; set; }

    public bool HasAnyField => HasEffectiveFrom || HasEffectiveTo;
}

public class GroupMemberResponse
{
    public TerritoryGroupMemberDto Member { get; set; } = null!;
}
