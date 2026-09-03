namespace SalesEvaluation.Application.HospitalRegistry;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.HospitalRegistry;
using SalesEvaluation.Domain.Entities;

// Module L — TierWeight (น้ำหนักตามระดับโรงพยาบาล). Default is 1.000 for every tier, so day-one
// behaviour equals raw metric sums (Territory & Potential Rules ข้อ 1); the table starts empty and
// rows appear only when a manager overrides a tier.
public class TierWeightService : ITierWeightService
{
    private const decimal DefaultTierWeight = 1.000m;

    private readonly IAppDbContext _dbContext;

    public TierWeightService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TierWeightsResponse> GetEffectiveTierWeightsAsync(CancellationToken cancellationToken = default)
    {
        var customRows = await _dbContext.TierWeights
            .AsNoTracking()
            .OrderBy(w => w.Tier)
            .ToListAsync(cancellationToken);

        var registryTiers = await _dbContext.HospitalRegistries
            .AsNoTracking()
            .Where(r => r.Tier != null)
            .Select(r => r.Tier!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var customByTier = customRows.ToDictionary(w => w.Tier, w => w);
        var tiers = registryTiers
            .Concat(customByTier.Keys)
            .Distinct()
            .OrderBy(t => t, StringComparer.Ordinal)
            .ToList();

        return new TierWeightsResponse
        {
            Weights = tiers.Select(tier =>
            {
                var custom = customByTier.GetValueOrDefault(tier);
                return new TierWeightDto
                {
                    Tier = tier,
                    Weight = (custom?.Weight ?? DefaultTierWeight).ToString(CultureInfo.InvariantCulture),
                    IsCustom = custom != null,
                    UpdatedAt = custom?.UpdatedAt
                };
            }).ToList()
        };
    }

    public async Task<TierWeightsResponse> UpsertTierWeightsAsync(List<(string Tier, decimal Weight)> weights, CancellationToken cancellationToken = default)
    {
        foreach (var entry in weights)
        {
            var existing = await _dbContext.TierWeights
                .FirstOrDefaultAsync(w => w.Tier == entry.Tier, cancellationToken);

            if (existing == null)
            {
                _dbContext.TierWeights.Add(new TierWeight
                {
                    Tier = entry.Tier,
                    Weight = entry.Weight,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.Weight = entry.Weight;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await GetEffectiveTierWeightsAsync(cancellationToken);
    }
}
