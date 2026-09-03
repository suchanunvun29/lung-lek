namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Territories;

/// <summary>
/// Territory management workflows: territory CRUD, temporal assignments, territory groups and
/// member periods, mirroring backend/src/controllers/territory.controller.ts +
/// services/territory.service.ts.
/// </summary>
public interface ITerritoryService
{
    Task<TerritoriesResponse> ListTerritoriesAsync(CancellationToken cancellationToken = default);

    Task<TerritoryResponse> CreateTerritoryAsync(CreateTerritoryRequest request, CancellationToken cancellationToken = default);

    Task<TerritoryResponse> UpdateTerritoryAsync(string id, UpdateTerritoryRequest request, CancellationToken cancellationToken = default);

    Task<TerritoryAssignmentsResponse> ListAssignmentsAsync(string? territoryId, string? salespersonId, string? status, CancellationToken cancellationToken = default);

    /// <summary>
    /// PUT /territory-assignments — assign (effectiveFrom present, 201) or withdraw
    /// (effectiveTo present, 200). Returns the saved assignment and whether it was a create.
    /// </summary>
    Task<(TerritoryAssignmentDto Assignment, bool Created)> PutAssignmentAsync(PutAssignmentRequest request, string assignedById, CancellationToken cancellationToken = default);

    Task<TerritoryGroupsResponse> ListGroupsAsync(CancellationToken cancellationToken = default);

    Task<TerritoryGroupResponse> CreateGroupAsync(CreateTerritoryGroupRequest request, CancellationToken cancellationToken = default);

    Task<TerritoryGroupResponse> UpdateGroupAsync(string id, UpdateTerritoryGroupRequest request, CancellationToken cancellationToken = default);

    /// <summary>Returns null when the group does not exist (caller maps to 404 "Territory group").</summary>
    Task<TerritoryGroupMemberDto?> AddGroupMemberAsync(string groupId, AddGroupMemberRequest request, CancellationToken cancellationToken = default);

    /// <summary>Returns null when the member does not exist (caller maps to 404 "Territory group member").</summary>
    Task<TerritoryGroupMemberDto> UpdateGroupMemberAsync(string groupId, string memberId, UpdateGroupMemberRequest request, CancellationToken cancellationToken = default);
}
