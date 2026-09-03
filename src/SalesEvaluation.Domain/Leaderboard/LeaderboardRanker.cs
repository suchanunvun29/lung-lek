namespace SalesEvaluation.Domain.Leaderboard;

using System.Collections.Generic;

public sealed class CriterionValue
{
    public required decimal? Value { get; init; }
    public required bool Computable { get; init; }
    public required string? Reason { get; init; }
}

public sealed class LeaderboardUnit<T>
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required CriterionValue Criterion { get; init; }
    public int? Rank { get; set; }
    public required T Data { get; init; }
}

public static class LeaderboardRanker
{
    public static void StandardCompetitionRanks<T>(
        List<LeaderboardUnit<T>> units,
        Func<LeaderboardUnit<T>, decimal?> valueSelector)
    {
        // Only rank units that have a value (computable)
        var rankable = units.Where(u => valueSelector(u).HasValue).ToList();
        var nonRankable = units.Where(u => !valueSelector(u).HasValue).ToList();

        var sorted = rankable
            .OrderByDescending(u => valueSelector(u)!.Value)
            .ToList();

        decimal? previousValue = null;
        int previousRank = 0;

        for (int i = 0; i < sorted.Count; i++)
        {
            var value = valueSelector(sorted[i]);
            if (value.HasValue && previousValue.HasValue && value.Value == previousValue.Value)
            {
                sorted[i].Rank = previousRank;
            }
            else
            {
                sorted[i].Rank = i + 1;
                previousValue = value;
                previousRank = i + 1;
            }
        }

        // Non-rankable units keep null rank
        foreach (var unit in nonRankable)
        {
            unit.Rank = null;
        }
    }

    public static (List<LeaderboardUnit<T>> Ranked, List<LeaderboardUnit<T>> Unranked) SplitRankedUnranked<T>(
        List<LeaderboardUnit<T>> units)
    {
        var ranked = units.Where(u => u.Criterion.Computable).ToList();
        var unranked = units.Where(u => !u.Criterion.Computable)
            .OrderBy(u => u.Name, StringComparer.Ordinal)
            .ToList();

        StandardCompetitionRanks(ranked, u => u.Criterion.Value);

        return (ranked, unranked);
    }
}

public enum LeaderboardCriteria
{
    Composite,
    PercentTarget,
    Revenue,
    NewCustomers
}