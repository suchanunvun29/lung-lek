namespace SalesEvaluation.Application.Settings;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Settings;
using SalesEvaluation.Domain.Entities;

public class SettingsService : ISettingsService
{
    private const int RevisionHistoryLimit = 50;

    private readonly IAppDbContext _dbContext;

    public SettingsService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ScoringWeightsResponse> GetScoringWeightsAsync(CancellationToken cancellationToken = default)
    {
        var weights = (await _dbContext.ScoringWeights
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            // Prisma orderBy { metric: "asc" } sorts the enum's string value alphabetically.
            .OrderBy(w => w.Metric.ToString(), StringComparer.Ordinal)
            .ToList();

        var revisions = await _dbContext.ScoringWeightRevisions
            .AsNoTracking()
            .Include(r => r.ChangedBy)
            .OrderByDescending(r => r.ChangedAt)
            .Take(RevisionHistoryLimit)
            .ToListAsync(cancellationToken);

        return new ScoringWeightsResponse
        {
            Weights = weights.Select(w => new ScoringWeightDto
            {
                Id = w.Id,
                Metric = w.Metric,
                Weight = w.Weight,
                UpdatedAt = w.UpdatedAt
            }).ToList(),
            Revisions = revisions.Select(r => new ScoringWeightRevisionDto
            {
                Id = r.Id,
                Before = SnapshotJson.Deserialize<List<ScoringWeightSnapshotEntryDto>>(r.Before) ?? new List<ScoringWeightSnapshotEntryDto>(),
                After = SnapshotJson.Deserialize<List<ScoringWeightSnapshotEntryDto>>(r.After) ?? new List<ScoringWeightSnapshotEntryDto>(),
                ChangedById = r.ChangedById,
                ChangedBy = new UserSummaryDto { Id = r.ChangedBy.Id, DisplayName = r.ChangedBy.DisplayName, Email = r.ChangedBy.Email },
                ChangedAt = r.ChangedAt,
                Note = r.Note
            }).ToList()
        };
    }

    public async Task<UpdatedScoringWeightsResponse> UpdateScoringWeightsAsync(
        List<ScoringWeightInputDto> weights,
        string changedById,
        string? note,
        CancellationToken cancellationToken = default)
    {
        var before = (await _dbContext.ScoringWeights
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            .OrderBy(w => w.Metric.ToString(), StringComparer.Ordinal)
            .ToList();

        var tracked = await _dbContext.ScoringWeights.ToListAsync(cancellationToken);
        foreach (var w in weights)
        {
            var row = tracked.First(existing => existing.Metric == w.Metric);
            row.Weight = w.Weight;
            row.UpdatedAt = DateTime.UtcNow;
        }

        var after = tracked.OrderBy(w => w.Metric.ToString(), StringComparer.Ordinal).ToList();

        _dbContext.ScoringWeightRevisions.Add(new ScoringWeightRevision
        {
            Id = Guid.NewGuid().ToString(),
            Before = SnapshotJson.Serialize(before.Select(w => new { metric = w.Metric.ToString(), weight = w.Weight }).ToList()),
            After = SnapshotJson.Serialize(after.Select(w => new { metric = w.Metric.ToString(), weight = w.Weight }).ToList()),
            ChangedById = changedById,
            Note = note ?? null
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UpdatedScoringWeightsResponse
        {
            Weights = after.OrderBy(w => w.Metric.ToString(), StringComparer.Ordinal).Select(w => new ScoringWeightDto
            {
                Id = w.Id,
                Metric = w.Metric,
                Weight = w.Weight,
                UpdatedAt = w.UpdatedAt
            }).ToList()
        };
    }

    public async Task<EvaluationSettingDto?> GetEvaluationSettingAsync(CancellationToken cancellationToken = default)
    {
        var setting = await _dbContext.EvaluationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == "singleton", cancellationToken);
        return setting == null ? null : MapSetting(setting);
    }

    public async Task<EvaluationSettingDto> UpdateEvaluationSettingAsync(
        EvaluationSettingUpdateInput input,
        string updatedById,
        CancellationToken cancellationToken = default)
    {
        var setting = await _dbContext.EvaluationSettings
            .FirstOrDefaultAsync(s => s.Id == "singleton", cancellationToken)
            ?? throw new InvalidOperationException("EvaluationSetting singleton row is missing");

        if (input.ChurnMonths.HasValue)
        {
            setting.ChurnMonths = input.ChurnMonths.Value;
        }

        if (input.MinMonthsForChurn.HasValue)
        {
            setting.MinMonthsForChurn = input.MinMonthsForChurn.Value;
        }

        if (input.MinMonthsForConsistency.HasValue)
        {
            setting.MinMonthsForConsistency = input.MinMonthsForConsistency.Value;
        }

        if (input.AiEnabled.HasValue)
        {
            setting.AiEnabled = input.AiEnabled.Value;
        }

        if (input.AiAnonymize.HasValue)
        {
            setting.AiAnonymize = input.AiAnonymize.Value;
        }

        if (input.PotentialMetric.HasValue)
        {
            setting.PotentialMetric = input.PotentialMetric.Value;
        }

        if (input.MinRegionCoverage.HasValue)
        {
            setting.MinRegionCoverage = input.MinRegionCoverage.Value;
        }

        if (input.TargetSuggestionAlpha.HasValue)
        {
            setting.TargetSuggestionAlpha = input.TargetSuggestionAlpha.Value;
        }

        if (input.TargetLookbackMonths.HasValue)
        {
            setting.TargetLookbackMonths = input.TargetLookbackMonths.Value;
        }

        if (input.TargetOutlierThreshold.HasValue)
        {
            setting.TargetOutlierThreshold = input.TargetOutlierThreshold.Value;
        }

        if (input.TargetGrowthRate.HasValue)
        {
            setting.TargetGrowthRate = input.TargetGrowthRate.Value;
        }

        setting.UpdatedById = updatedById;
        setting.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapSetting(setting);
    }

    private static EvaluationSettingDto MapSetting(EvaluationSetting setting) => new()
    {
        Id = setting.Id,
        ChurnMonths = setting.ChurnMonths,
        MinMonthsForChurn = setting.MinMonthsForChurn,
        MinMonthsForConsistency = setting.MinMonthsForConsistency,
        AiEnabled = setting.AiEnabled,
        AiAnonymize = setting.AiAnonymize,
        PotentialMetric = setting.PotentialMetric,
        MinRegionCoverage = setting.MinRegionCoverage.ToString(CultureInfo.InvariantCulture),
        TargetSuggestionAlpha = setting.TargetSuggestionAlpha.ToString(CultureInfo.InvariantCulture),
        TargetLookbackMonths = setting.TargetLookbackMonths,
        TargetOutlierThreshold = setting.TargetOutlierThreshold.ToString(CultureInfo.InvariantCulture),
        TargetGrowthRate = setting.TargetGrowthRate.ToString(CultureInfo.InvariantCulture),
        UpdatedById = setting.UpdatedById,
        UpdatedAt = setting.UpdatedAt
    };
}
