namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Leaderboard;
using Xunit;

public class FieldMaskerTests
{
    private static SerializedTerritoryRow CreateFullRow()
        => new SerializedTerritoryRow
        {
            Visibility = VisibilityLevel.TerritoryFull,
            TerritoryId = 1,
            Name = "Territory 1",
            OwnerNames = new List<string> { "Owner 1" },
            CompositeScore = 85.5m,
            ComputedMetricLabel = "คิดจาก 5 จาก 5 เกณฑ์",
            Revenue = 1000000m,
            RevenueTarget = 1200000m,
            TargetLabel = "1,200,000",
            AchievementPercent = 83.33m
        };

    private static SerializedTerritoryRow CreateRestrictedRow()
        => new SerializedTerritoryRow
        {
            Visibility = VisibilityLevel.TerritoryRestricted,
            TerritoryId = 1,
            Name = "Territory 1",
            OwnerNames = new List<string> { "Owner 1" },
            CompositeScore = 85.5m,
            ComputedMetricLabel = "คิดจาก 5 จาก 5 เกณฑ์",
            Revenue = 1000000m,
            RevenueTarget = 1200000m,
            TargetLabel = "1,200,000",
            AchievementPercent = 83.33m
        };

    [Fact]
    public void MaskTerritoryRow_FullVisibility_IncludesAllFields()
    {
        var serialized = CreateFullRow();
        var result = FieldMasker.MaskTerritoryRow(serialized, 1, "TERRITORY", null);

        Assert.Equal(VisibilityLevel.TerritoryFull, result.Visibility);
        Assert.Equal("TERRITORY", result.UnitType);
        Assert.Equal(1, result.TerritoryId);
        Assert.Equal("Territory 1", result.Name);
        Assert.Single(result.OwnerNames);
        Assert.Equal(1, result.Rank);
        Assert.Equal(85.5m, result.CompositeScore);
        Assert.Equal("คิดจาก 5 จาก 5 เกณฑ์", result.ComputedMetricLabel);
        Assert.Equal(1000000m, result.Revenue);
        Assert.Equal(1200000m, result.RevenueTarget);
        Assert.Equal("1,200,000", result.TargetLabel);
        Assert.Equal(83.33m, result.AchievementPercent);
    }

    [Fact]
    public void MaskTerritoryRow_RestrictedVisibility_MasksSensitiveFields()
    {
        var serialized = CreateRestrictedRow();
        var result = FieldMasker.MaskTerritoryRow(serialized, 1, "TERRITORY", null);

        Assert.Equal(VisibilityLevel.TerritoryRestricted, result.Visibility);
        Assert.Equal("TERRITORY", result.UnitType);
        Assert.Equal(1, result.TerritoryId);
        Assert.Equal("Territory 1", result.Name);
        Assert.Single(result.OwnerNames);
        Assert.Equal(1, result.Rank);
        Assert.Equal(85.5m, result.CompositeScore);
        Assert.Equal("คิดจาก 5 จาก 5 เกณฑ์", result.ComputedMetricLabel);

        // Sensitive fields should be null/default
        Assert.Null(result.Revenue);
        Assert.Null(result.RevenueTarget);
        Assert.Null(result.TargetLabel);
        Assert.Null(result.AchievementPercent);
    }

    [Fact]
    public void MaskTerritoryRow_IncludesCriterionReason()
    {
        var serialized = CreateFullRow();
        var result = FieldMasker.MaskTerritoryRow(serialized, 1, "TERRITORY", "ข้อมูลยังไม่เพียงพอ");

        Assert.Equal("ข้อมูลยังไม่เพียงพอ", result.CriterionReason);
    }

    [Fact]
    public void MaskTerritoryRow_IncludesMembers()
    {
        var serialized = CreateFullRow();
        var members = new List<LeaderboardRow<UnitMember>>
        {
            new LeaderboardRow<UnitMember>
            {
                Visibility = VisibilityLevel.TerritoryFull,
                UnitType = "TERRITORY",
                TerritoryId = 2,
                Name = "Member 1",
                OwnerNames = new List<string> { "Owner" }
            }
        };
        var result = FieldMasker.MaskTerritoryRow(serialized, 1, "GROUP", null, members);

        Assert.Single(result.Members!);
    }

    [Fact]
    public void MaskGroupMember_FullVisibility_IncludesAllFields()
    {
        var serialized = CreateFullRow();
        var result = FieldMasker.MaskGroupMember(serialized);

        Assert.Equal(VisibilityLevel.TerritoryFull, result.Visibility);
        Assert.Equal(1000000m, result.Revenue);
        Assert.Equal(1200000m, result.RevenueTarget);
        Assert.Equal("1,200,000", result.TargetLabel);
        Assert.Equal(83.33m, result.AchievementPercent);
    }

    [Fact]
    public void MaskGroupMember_RestrictedVisibility_MasksSensitiveFields()
    {
        var serialized = CreateRestrictedRow();
        var result = FieldMasker.MaskGroupMember(serialized);

        Assert.Equal(VisibilityLevel.TerritoryRestricted, result.Visibility);
        Assert.Null(result.Revenue);
        Assert.Null(result.RevenueTarget);
        Assert.Null(result.TargetLabel);
        Assert.Null(result.AchievementPercent);
    }
}