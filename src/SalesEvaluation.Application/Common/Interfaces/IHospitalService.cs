namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Hospitals;

public interface IHospitalService
{
    Task<HospitalsResponse> ListHospitalsAsync(CancellationToken cancellationToken = default);
    Task<HospitalResponse> UpdateHospitalAsync(int id, UpdateHospitalRequest request, CancellationToken cancellationToken = default);
    Task<CreateHospitalAliasResponse> AddHospitalAliasAsync(int hospitalId, CreateHospitalAliasRequest request, int userId, CancellationToken cancellationToken = default);
    Task<HospitalResponse> PatchHospitalTerritoryAsync(int id, PatchHospitalTerritoryRequest request, int userId, CancellationToken cancellationToken = default);
    Task<BulkMoveHospitalsResponse> BulkMoveHospitalsByProvinceAsync(BulkMoveHospitalsByProvinceRequest request, int userId, CancellationToken cancellationToken = default);
    Task<UnassignedTerritoryHospitalsResponse> ListUnassignedTerritoryHospitalsAsync(CancellationToken cancellationToken = default);
}
