namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Leaderboard;
using Xunit;

public class LeaderboardRankerTests
{
    private static LeaderboardUnit<TestData> CreateUnit(string id, string name, decimal? value, bool computable, string? reason = null, TestData? data = null)
        => new LeaderboardUnit<TestData>
        {
            Id = id,
            Name = name,
            Criterion = new CriterionValue { Value = value, Computable = computable, Reason = reason },
            Data = data ?? new TestData()
        };

    private sealed class TestData { }

    [Fact]
    public void StandardCompetitionRanks_SimpleRanking()
    {
        var units = new List<LeaderboardUnit<TestData>>
        {
            CreateUnit("1", "A", 100m, true),
            CreateUnit("2", "B", 80m, true),
            CreateUnit("3", "C", 90m, true)
        };

        LeaderboardRanker.StandardCompetitionRanks(units, u => u.Criterion.Value);

        Assert.Equal(1, units.First(u => u.Id == "1").Rank); // 100 -> rank 1
        Assert.Equal(3, units.First(u => u.Id == "2").Rank); // 80 -> rank 3
        Assert.Equal(2, units.First(u => u.Id == "3").Rank); // 90 -> rank 2
    }

    [Fact]
    public void StandardCompetitionRanks_TiesGetSameRank()
    {
        var units = new List<LeaderboardUnit<TestData>>
        {
            CreateUnit("1", "A", 100m, true),
            CreateUnit("2", "B", 100m, true),
            CreateUnit("3", "C", 80m, true)
        };

        LeaderboardRanker.StandardCompetitionRanks(units, u => u.Criterion.Value);

        Assert.Equal(1, units.First(u => u.Id == "1").Rank);
        Assert.Equal(1, units.First(u => u.Id == "2").Rank);
        Assert.Equal(3, units.First(u => u.Id == "3").Rank); // Standard competition: 1, 1, 3
    }

    [Fact]
    public void StandardCompetitionRanks_MultipleTies()
    {
        var units = new List<LeaderboardUnit<TestData>>
        {
            CreateUnit("1", "A", 100m, true),
            CreateUnit("2", "B", 100m, true),
            CreateUnit("3", "C", 90m, true),
            CreateUnit("4", "D", 90m, true),
            CreateUnit("5", "E", 80m, true)
        };

        LeaderboardRanker.StandardCompetitionRanks(units, u => u.Criterion.Value);

        Assert.Equal(1, units.First(u => u.Id == "1").Rank);
        Assert.Equal(1, units.First(u => u.Id == "2").Rank);
        Assert.Equal(3, units.First(u => u.Id == "3").Rank);
        Assert.Equal(3, units.First(u => u.Id == "4").Rank);
        Assert.Equal(5, units.First(u => u.Id == "5").Rank); // Standard competition: 1, 1, 3, 3, 5
    }

    [Fact]
    public void StandardCompetitionRanks_NullValuesGoToEnd()
    {
        var units = new List<LeaderboardUnit<TestData>>
        {
            CreateUnit("1", "A", 100m, true),
            CreateUnit("2", "B", null, false),
            CreateUnit("3", "C", 80m, true)
        };

        LeaderboardRanker.StandardCompetitionRanks(units, u => u.Criterion.Value);

        Assert.Equal(1, units.First(u => u.Id == "1").Rank);
        Assert.Equal(2, units.First(u => u.Id == "3").Rank);
        Assert.Null(units.First(u => u.Id == "2").Rank); // Not computable, no rank assigned
    }

    [Fact]
    public void SplitRankedUnranked_SeparatesCorrectly()
    {
        var units = new List<LeaderboardUnit<TestData>>
        {
            CreateUnit("1", "A", 100m, true),
            CreateUnit("2", "B", 80m, true),
            CreateUnit("3", "C", null, false),
            CreateUnit("4", "D", null, false)
        };

        var (ranked, unranked) = LeaderboardRanker.SplitRankedUnranked(units);

        Assert.Equal(2, ranked.Count);
        Assert.Equal(2, unranked.Count);
        Assert.Equal("A", ranked[0].Name); // ranked sorted by value desc
        Assert.Equal("B", ranked[1].Name);
        Assert.Equal("C", unranked[0].Name); // unranked sorted by name
        Assert.Equal("D", unranked[1].Name);
        Assert.Equal(1, ranked[0].Rank);
        Assert.Equal(2, ranked[1].Rank);
    }
}