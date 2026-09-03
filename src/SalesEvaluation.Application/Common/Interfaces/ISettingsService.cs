namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Settings;

public interface ISettingsService
{
    /// <summary>GET /settings/scoring-weights — current weights + last 50 revisions.</summary>
    Task<ScoringWeightsResponse> GetScoringWeightsAsync(CancellationToken cancellationToken = default);

    /// <summary>PUT /settings/scoring-weights — update weights and write a ScoringWeightRevision snapshot. Callers must validate the 5-unique-metrics / sum-100 rules first.</summary>
    Task<UpdatedScoringWeightsResponse> UpdateScoringWeightsAsync(List<ScoringWeightInputDto> weights, int changedById, string? note, CancellationToken cancellationToken = default);

    /// <summary>GET /settings/evaluation — null when the singleton row is missing (endpoint maps to 500).</summary>
    Task<EvaluationSettingDto?> GetEvaluationSettingAsync(CancellationToken cancellationToken = default);

    /// <summary>PATCH /settings/evaluation — apply the provided fields only.</summary>
    Task<EvaluationSettingDto> UpdateEvaluationSettingAsync(EvaluationSettingUpdateInput input, int updatedById, CancellationToken cancellationToken = default);
}
