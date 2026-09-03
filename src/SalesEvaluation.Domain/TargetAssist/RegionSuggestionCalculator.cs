namespace SalesEvaluation.Domain.TargetAssist;

using System.Collections.Generic;

public sealed class RegionUnitInput
{
    public required int TerritoryId { get; init; }
    public required decimal Potential { get; init; }
    public required decimal? TerritoryCoverage { get; init; }
    public required decimal HistoryBase { get; init; }
}

public sealed class RegionSuggestionRow
{
    public required int TerritoryId { get; init; }
    public required decimal Potential { get; init; }
    public required decimal? TerritoryCoverage { get; init; }
    public required decimal HistoryBase { get; init; }
    public decimal PotentialShare { get; set; }
    public decimal HistoryBased { get; set; }
    public decimal PotentialBased { get; set; }
    public decimal W { get; set; }
    public decimal Suggested { get; set; }
    public decimal? PenetrationIndex { get; set; }
}

public sealed class RegionSuggestionResult
{
    public required bool CoveragePass { get; init; }
    public required decimal R { get; init; }
    public required decimal SuggestedSum { get; init; }
    public required decimal PotentialBasedSum { get; init; }
    public required List<RegionSuggestionRow> Rows { get; init; }
}

public static class RegionSuggestionCalculator
{
    public static decimal MonthlyHistoryValue(decimal baseValue, int monthsUsed, decimal growthRate)
    {
        return monthsUsed > 0 ? (baseValue / monthsUsed) * growthRate : 0m;
    }

    public static RegionSuggestionResult ComputeRegionSuggestions(
        decimal? regionCoverage,
        decimal minRegionCoverage,
        decimal alpha,
        int monthsUsed,
        decimal growthRate,
        IReadOnlyDictionary<int, decimal>? rebalanceTargetByTerritory,
        IEnumerable<RegionUnitInput> units)
    {
        var unitList = units.ToList();
        var rows = unitList.Select(u => new RegionSuggestionRow
        {
            TerritoryId = u.TerritoryId,
            Potential = u.Potential,
            TerritoryCoverage = u.TerritoryCoverage,
            HistoryBase = u.HistoryBase,
            PotentialShare = 0m,
            HistoryBased = MonthlyHistoryValue(u.HistoryBase, monthsUsed, growthRate),
            PotentialBased = 0m,
            W = 0m,
            Suggested = 0m
        }).ToList();

        var potentialTotal = rows.Sum(r => r.Potential);

        decimal r;
        if (rebalanceTargetByTerritory != null)
        {
            r = rebalanceTargetByTerritory.Values.Sum();
        }
        else
        {
            r = rows.Sum(r => r.HistoryBased);
        }

        var coveragePass = regionCoverage.HasValue && regionCoverage.Value >= minRegionCoverage;

        foreach (var row in rows)
        {
            row.PotentialShare = potentialTotal > 0 ? row.Potential / potentialTotal : 0m;
            row.PotentialBased = r * row.PotentialShare;

            row.W = coveragePass ? Math.Min(1 - alpha, row.TerritoryCoverage ?? 0m) : 0m;
            row.Suggested = (1 - row.W) * row.HistoryBased + row.W * row.PotentialBased;
        }

        return new RegionSuggestionResult
        {
            CoveragePass = coveragePass,
            R = r,
            SuggestedSum = rows.Sum(r => r.Suggested),
            PotentialBasedSum = rows.Sum(r => r.PotentialBased),
            Rows = rows
        };
    }
}