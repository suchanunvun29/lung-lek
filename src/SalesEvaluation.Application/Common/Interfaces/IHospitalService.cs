namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Hospitals;

public interface IHospitalService
{
    Task<HospitalsResponse> ListHospitalsAsync(CancellationToken cancellationToken = default);
    Task<HospitalResponse> UpdateHospitalAsync(string id, UpdateHospitalRequest request, CancellationToken cancellationToken = default);
    Task<CreateHospitalAliasResponse> AddHospitalAliasAsync(string hospitalId, CreateHospitalAliasRequest request, string userId, CancellationToken cancellationToken = default);
    Task<HospitalResponse> PatchHospitalTerritoryAsync(string id, PatchHospitalTerritoryRequest request, string userId, CancellationToken cancellationToken = default);
    Task<BulkMoveHospitalsResponse> BulkMoveHospitalsByProvinceAsync(BulkMoveHospitalsByProvinceRequest request, string userId, CancellationToken cancellationToken = default);
    Task<UnassignedTerritoryHospitalsResponse> ListUnassignedTerritoryHospitalsAsync(CancellationToken cancellationToken = default);
}
