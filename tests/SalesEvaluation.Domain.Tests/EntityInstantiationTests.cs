namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class EntityInstantiationTests
{
    [Fact]
    public void UserEntity_DefaultValues_ShouldBeCorrect()
    {
        var user = new User
        {
            Id = "user_1",
            Email = "manager@example.com",
            PasswordHash = "hash",
            DisplayName = "Manager",
            Role = UserRole.MANAGER
        };

        Assert.True(user.IsActive);
        Assert.True(user.MustChangePassword);
        Assert.Empty(user.ImportBatches);
        Assert.Empty(user.HospitalAliases);
    }

    [Fact]
    public void SalesLine_CreationAndCredits_ShouldWork()
    {
        var salesLine = new SalesLine
        {
            Id = "sl_1",
            InvoiceNo = "INV-001",
            InvoiceDate = new DateOnly(2026, 8, 1),
            Year = 2026,
            Month = 8,
            HospitalId = "hosp_1",
            SalespersonId = "sp_1",
            ProductId = "prod_1",
            ProductTypeId = "pt_1",
            Qty = 10m,
            UnitPrice = 100m,
            Amount = 1000m,
            Vat = 70m,
            Total = 1070m,
            RowKey = "INV-001|ProductA||1",
            SourceSheetName = "August",
            SourceRowNumber = 2,
            ImportBatchId = "batch_1"
        };

        var credit = new SalesLineCredit
        {
            Id = "credit_1",
            SalesLineId = salesLine.Id,
            SalesLine = salesLine,
            SalespersonId = "sp_1",
            SharePercent = 100.000m,
            IsPrimary = true
        };

        salesLine.Credits.Add(credit);

        Assert.Single(salesLine.Credits);
        Assert.Equal(100.000m, salesLine.Credits.First().SharePercent);
        Assert.True(salesLine.Credits.First().IsPrimary);
    }

    [Fact]
    public void EvaluationSetting_DefaultValues_ShouldMatchDomainRules()
    {
        var setting = new EvaluationSetting();

        Assert.Equal("singleton", setting.Id);
        Assert.Equal(6, setting.ChurnMonths);
        Assert.Equal(6, setting.MinMonthsForChurn);
        Assert.Equal(6, setting.MinMonthsForConsistency);
        Assert.True(setting.AiEnabled);
        Assert.True(setting.AiAnonymize);
        Assert.Equal(PotentialMetricKey.BEDS, setting.PotentialMetric);
        Assert.Equal(0.50m, setting.MinRegionCoverage);
        Assert.Equal(1.000m, setting.TargetSuggestionAlpha);
        Assert.Equal(3, setting.TargetLookbackMonths);
        Assert.Equal(0.40m, setting.TargetOutlierThreshold);
        Assert.Equal(1.000m, setting.TargetGrowthRate);
    }

    [Fact]
    public void Target_Creation_ShouldHoldProductGroupsAndRevisions()
    {
        var target = new Target
        {
            Id = "tgt_1",
            Scope = TargetScope.SALESPERSON,
            SalespersonId = "sp_1",
            Year = 2026,
            Month = 8,
            RevenueTarget = 500000m,
            NewCustomerTarget = 3
        };

        target.ProductGroupTargets.Add(new TargetProductGroup
        {
            Id = "tpg_1",
            TargetId = target.Id,
            ProductTypeId = "pt_1",
            RevenueTarget = 200000m
        });

        target.Revisions.Add(new TargetRevision
        {
            Id = "rev_1",
            TargetId = target.Id,
            ChangeType = TargetChangeType.CREATE,
            ChangedById = "user_1"
        });

        Assert.Single(target.ProductGroupTargets);
        Assert.Single(target.Revisions);
        Assert.Equal(500000m, target.RevenueTarget);
    }
}
