namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Hospitals;

public interface IHospitalService
{
    Task<HospitalsResponse> ListHospitalsAsync(CancellationToken cancellationToken = default);
    /// <summary>T-UX-025 — paged variant; total counts after the q filter.</summary>
    Task<HospitalsPageResponse> ListHospitalsPageAsync(int page, int pageSize, string? q = null, CancellationToken cancellationToken = default);
    Task<HospitalResponse> UpdateHospitalAsync(int id, UpdateHospitalRequest request, CancellationToken cancellationToken = default);
    Task<CreateHospitalAliasResponse> AddHospitalAliasAsync(int hospitalId, CreateHospitalAliasRequest request, int userId, CancellationToken cancellationToken = default);
    Task<HospitalResponse> PatchHospitalTerritoryAsync(int id, PatchHospitalTerritoryRequest request, int userId, CancellationToken cancellationToken = default);
    Task<BulkMoveHospitalsResponse> BulkMoveHospitalsByProvinceAsync(BulkMoveHospitalsByProvinceRequest request, int userId, CancellationToken cancellationToken = default);
    /// <summary>T-UX-026 — assign one territory to many hospitals; each hospital commits on its own (per-item atomic).</summary>
    Task<BulkAssignTerritoryResponse> BulkAssignTerritoryAsync(BulkAssignTerritoryRequest request, int userId, CancellationToken cancellationToken = default);
    Task<UnassignedTerritoryHospitalsResponse> ListUnassignedTerritoryHospitalsAsync(CancellationToken cancellationToken = default);
}
