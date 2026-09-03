namespace SalesEvaluation.Domain.Leaderboard;

using System.Collections.Generic;

public enum VisibilityLevel
{
    TerritoryFull,
    TerritoryRestricted
}

public sealed class SerializedTerritoryRow
{
    public required VisibilityLevel Visibility { get; init; }
    public required int TerritoryId { get; init; }
    public required string Name { get; init; }
    public required List<string> OwnerNames { get; init; }
    public decimal? CompositeScore { get; init; }
    public string? ComputedMetricLabel { get; init; }
    public decimal? Revenue { get; init; }
    public decimal? RevenueTarget { get; init; }
    public string? TargetLabel { get; init; }
    public decimal? AchievementPercent { get; init; }
}

public sealed class LeaderboardRow<T>
{
    public required VisibilityLevel Visibility { get; init; }
    public required string UnitType { get; init; }
    public required int TerritoryId { get; init; }
    public required string Name { get; init; }
    public required List<string> OwnerNames { get; init; }
    public int? Rank { get; init; }
    public decimal? CompositeScore { get; init; }
    public string? ComputedMetricLabel { get; init; }
    public string? CriterionReason { get; init; }
    public List<T>? Members { get; init; }

    // Full visibility fields (only for TerritoryFull)
    public decimal? Revenue { get; init; }
    public decimal? RevenueTarget { get; init; }
    public string? TargetLabel { get; init; }
    public decimal? AchievementPercent { get; init; }
}

public static class FieldMasker
{
    public static LeaderboardRow<LeaderboardRow<UnitMember>> MaskTerritoryRow(
        SerializedTerritoryRow serialized,
        int? rank,
        string unitType,
        string? criterionReason,
        List<LeaderboardRow<UnitMember>>? members = null)
    {
        if (serialized.Visibility == VisibilityLevel.TerritoryFull)
        {
            return new LeaderboardRow<LeaderboardRow<UnitMember>>
            {
                Visibility = serialized.Visibility,
                UnitType = unitType,
                TerritoryId = serialized.TerritoryId,
                Name = serialized.Name,
                OwnerNames = serialized.OwnerNames,
                Rank = rank,
                CompositeScore = serialized.CompositeScore,
                ComputedMetricLabel = serialized.ComputedMetricLabel,
                CriterionReason = criterionReason,
                Members = members,
                Revenue = serialized.Revenue,
                RevenueTarget = serialized.RevenueTarget,
                TargetLabel = serialized.TargetLabel,
                AchievementPercent = serialized.AchievementPercent
            };
        }

        return new LeaderboardRow<LeaderboardRow<UnitMember>>
        {
            Visibility = serialized.Visibility,
            UnitType = unitType,
            TerritoryId = serialized.TerritoryId,
            Name = serialized.Name,
            OwnerNames = serialized.OwnerNames,
            Rank = rank,
            CompositeScore = serialized.CompositeScore,
            ComputedMetricLabel = serialized.ComputedMetricLabel,
            CriterionReason = criterionReason,
            Members = members
        };
    }

    public static LeaderboardRow<UnitMember> MaskGroupMember(
        SerializedTerritoryRow serialized,
        string unitType = "TERRITORY")
    {
        if (serialized.Visibility == VisibilityLevel.TerritoryFull)
        {
            return new LeaderboardRow<UnitMember>
            {
                Visibility = serialized.Visibility,
                UnitType = unitType,
                TerritoryId = serialized.TerritoryId,
                Name = serialized.Name,
                OwnerNames = serialized.OwnerNames,
                Rank = null,
                CompositeScore = serialized.CompositeScore,
                ComputedMetricLabel = serialized.ComputedMetricLabel,
                CriterionReason = null,
                Members = null,
                Revenue = serialized.Revenue,
                RevenueTarget = serialized.RevenueTarget,
                TargetLabel = serialized.TargetLabel,
                AchievementPercent = serialized.AchievementPercent
            };
        }

        return new LeaderboardRow<UnitMember>
        {
            Visibility = serialized.Visibility,
            UnitType = unitType,
            TerritoryId = serialized.TerritoryId,
            Name = serialized.Name,
            OwnerNames = serialized.OwnerNames,
            Rank = null,
            CompositeScore = serialized.CompositeScore,
            ComputedMetricLabel = serialized.ComputedMetricLabel,
            CriterionReason = null,
            Members = null
        };
    }
}

public sealed class UnitMember
{
    public required string Name { get; init; }
    public required List<string> OwnerNames { get; init; }
    public decimal? CompositeScore { get; init; }
    public string? ComputedMetricLabel { get; init; }
    public decimal? Revenue { get; init; }
    public decimal? RevenueTarget { get; init; }
    public string? TargetLabel { get; init; }
    public decimal? AchievementPercent { get; init; }
    public VisibilityLevel Visibility { get; init; }
}

public sealed class SelfSummaryResult
{
    public required string Mode { get; init; } // "FULL" or "SELF_SUMMARY"
    public required LeaderboardCriteria Criteria { get; init; }
    public int? Rank { get; init; }
    public int TotalRanked { get; init; }
    public decimal? OwnValue { get; init; }
    public bool OwnComputable { get; init; }
    public string? Reason { get; init; }
    public decimal? TeamAverage { get; init; }
}