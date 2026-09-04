namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.HospitalRegistry;

/// <summary>
/// Hospital registry, province mapping, registry-link review and tier-weight workflows,
/// mirroring backend/src/controllers/registry.controller.ts + services/tierWeight.service.ts.
/// </summary>
public interface IHospitalRegistryService
{
    Task<ProvincesResponse> ListProvincesAsync(CancellationToken cancellationToken = default);

    Task<ProvinceResponse> UpdateProvinceAsync(int id, UpdateProvinceRequest request, CancellationToken cancellationToken = default);

    /// <summary>Paginated registry list with text search (`q`), province and territory filters.</summary>
    Task<HospitalRegistriesResponse> ListHospitalRegistriesAsync(string? q, int? provinceMappingId, int? territoryId, int page, int pageSize, CancellationToken cancellationToken = default);

    Task<PotentialAdjustmentResponse> UpdatePotentialAdjustmentAsync(int id, decimal potentialAdjustment, CancellationToken cancellationToken = default);

    Task<HospitalRegistryLinksResponse> ListRegistryLinksAsync(string? status, CancellationToken cancellationToken = default);

    Task<HospitalRegistryLinkResponse> UpdateRegistryLinkAsync(int hospitalId, UpdateRegistryLinkRequest request, int reviewedById, CancellationToken cancellationToken = default);

    Task<RegistryImportResultDto> ImportHospitalRegistryAsync(byte[] fileBytes, string fileName, int fileSizeBytes, int uploadedById, CancellationToken cancellationToken = default);
}

public interface ITierWeightService
{
    /// <summary>Every tier defaults to weight 1.000 unless a manager has customized it.</summary>
    Task<TierWeightsResponse> GetEffectiveTierWeightsAsync(CancellationToken cancellationToken = default);

    Task<TierWeightsResponse> UpsertTierWeightsAsync(List<(string Tier, decimal Weight)> weights, CancellationToken cancellationToken = default);
}
