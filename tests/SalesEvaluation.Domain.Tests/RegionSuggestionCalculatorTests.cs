namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.TargetAssist;
using Xunit;

public class RegionSuggestionCalculatorTests
{
    private static RegionUnitInput CreateUnit(string territoryId, decimal potential, decimal? coverage, decimal historyBase)
        => new RegionUnitInput
        {
            TerritoryId = territoryId,
            Potential = potential,
            TerritoryCoverage = coverage,
            HistoryBase = historyBase
        };

    [Fact]
    public void MonthlyHistoryValue_CalculatesCorrectly()
    {
        var result = RegionSuggestionCalculator.MonthlyHistoryValue(1200m, 12, 1.1m);
        Assert.Equal(110m, result); // (1200/12) * 1.1 = 110
    }

    [Fact]
    public void MonthlyHistoryValue_ZeroMonthsReturnsZero()
    {
        var result = RegionSuggestionCalculator.MonthlyHistoryValue(1200m, 0, 1.1m);
        Assert.Equal(0m, result);
    }

    [Fact]
    public void ComputeRegionSuggestions_SuggestMode_NoRebalance()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, 0.8m, 500m),
            CreateUnit("T2", 2000m, 0.6m, 300m),
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: 0.7m,
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: null,
            units);

        Assert.True(result.CoveragePass);
        // T1: (500/12) * 1.1 = 45.833..., T2: (300/12) * 1.1 = 27.5
        Assert.Equal(500m / 12m * 1.1m + 300m / 12m * 1.1m, result.R);
        Assert.Equal(2, result.Rows.Count);

        // T1: potentialShare = 1000/3000 = 1/3, potentialBased = 800 * 1/3
        // w = min(1-0.3, 0.8) = min(0.7, 0.8) = 0.7
        // historyBased = (500/12) * 1.1 = 45.833...
        // suggested = (1-0.7)*45.833 + 0.7*266.667 = 13.75 + 186.667 = 200.417

        var t1Row = result.Rows.First(r => r.TerritoryId == "T1");
        Assert.Equal(1000m / 3000m, t1Row.PotentialShare);
        Assert.Equal(500m / 12m * 1.1m, t1Row.HistoryBased);
        // R = 73.333..., potentialShare = 1/3, so potentialBased = 73.333... * 1/3 = 24.444...
        Assert.Equal((500m / 12m * 1.1m + 300m / 12m * 1.1m) * (1000m / 3000m), t1Row.PotentialBased);
        Assert.Equal(Math.Min(0.7m, 0.8m), t1Row.W);

        // T2: potentialShare = 2000/3000 = 2/3
        var t2Row = result.Rows.First(r => r.TerritoryId == "T2");
        Assert.Equal(2000m / 3000m, t2Row.PotentialShare);
        Assert.Equal(300m / 12m * 1.1m, t2Row.HistoryBased);
        Assert.Equal((500m / 12m * 1.1m + 300m / 12m * 1.1m) * (2000m / 3000m), t2Row.PotentialBased);
        Assert.Equal(Math.Min(0.7m, 0.6m), t2Row.W);
    }

    [Fact]
    public void ComputeRegionSuggestions_RebalanceMode()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, 0.8m, 500m),
            CreateUnit("T2", 2000m, 0.6m, 300m),
        };

        var rebalanceTargets = new Dictionary<string, decimal>
        {
            { "T1", 1000m },
            { "T2", 2000m }
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: 0.7m,
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: rebalanceTargets,
            units);

        Assert.True(result.CoveragePass);
        Assert.Equal(3000m, result.R); // sum of rebalance targets
    }

    [Fact]
    public void ComputeRegionSuggestions_CoverageFail_WZero()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, 0.8m, 500m),
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: 0.4m, // below minRegionCoverage 0.5
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: null,
            units);

        Assert.False(result.CoveragePass);
        Assert.Equal(0m, result.Rows[0].W);
        Assert.Equal(result.Rows[0].HistoryBased, result.Rows[0].Suggested); // w=0 means 100% history
    }

    [Fact]
    public void ComputeRegionSuggestions_NullCoverage_WZero()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, null, 500m),
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: null,
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: null,
            units);

        Assert.False(result.CoveragePass);
        Assert.Equal(0m, result.Rows[0].W);
    }

    [Fact]
    public void ComputeRegionSuggestions_NoRenormalization_SumMayDifferFromR()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, 0.8m, 500m),
            CreateUnit("T2", 2000m, 0.6m, 300m),
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: 0.7m,
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: null,
            units);

        // Sum of suggested should NOT necessarily equal R (no renormalization)
        // This is the Module L invariant
        var suggestedSum = result.Rows.Sum(r => r.Suggested);
        // The difference is surfaced as-is
        Assert.NotEqual(result.R, suggestedSum); // In this case they differ
    }

    [Fact]
    public void ComputeRegionSuggestions_UnitWithNullCoverage()
    {
        var units = new[]
        {
            CreateUnit("T1", 1000m, null, 500m), // No sales at all
        };

        var result = RegionSuggestionCalculator.ComputeRegionSuggestions(
            regionCoverage: 0.7m,
            minRegionCoverage: 0.5m,
            alpha: 0.3m,
            monthsUsed: 12,
            growthRate: 1.1m,
            rebalanceTargetByTerritory: null,
            units);

        Assert.True(result.CoveragePass);
        // territoryCoverage is null, so min(1-alpha, null) = 0 (null treated as 0)
        Assert.Equal(0m, result.Rows[0].W);
    }
}