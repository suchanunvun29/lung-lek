namespace SalesEvaluation.IntegrationTests;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Persistence;
using Xunit;

public class AppDbContextModelTests
{
    private readonly AppDbContext _dbContext;

    public AppDbContextModelTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=dummy;Username=dummy;Password=dummy")
            .Options;

        _dbContext = new AppDbContext(options);
    }

    [Fact]
    public void AppDbContext_Model_ShouldContainAllDomainEntities()
    {
        var model = _dbContext.Model;

        var expectedEntityTypes = new[]
        {
            typeof(User),
            typeof(Salesperson),
            typeof(Hospital),
            typeof(HospitalAlias),
            typeof(HospitalNameReview),
            typeof(ProductType),
            typeof(Product),
            typeof(ProductAlias),
            typeof(SalesmanNameReview),
            typeof(SalesmanNameRule),
            typeof(SalesmanNameRuleMember),
            typeof(SalesLine),
            typeof(SalesLineCredit),
            typeof(ImportBatch),
            typeof(ImportIssue),
            typeof(SalesLineArchive),
            typeof(Region),
            typeof(ProvinceMapping),
            typeof(ProvinceAlias),
            typeof(Territory),
            typeof(TerritoryAssignment),
            typeof(TerritoryGroup),
            typeof(TerritoryGroupMember),
            typeof(HospitalTerritoryChange),
            typeof(HospitalRegistry),
            typeof(HospitalPotentialMetric),
            typeof(HospitalRegistryLink),
            typeof(TierWeight),
            typeof(Target),
            typeof(TargetProductGroup),
            typeof(TargetRevision),
            typeof(ScoringWeight),
            typeof(ScoringWeightRevision),
            typeof(EvaluationSetting),
            typeof(CoachingInsight)
        };

        foreach (var type in expectedEntityTypes)
        {
            var entityType = model.FindEntityType(type);
            Assert.NotNull(entityType);
        }
    }

    [Fact]
    public void AppDbContext_Model_ShouldMapToPascalCaseQuotedTables()
    {
        var model = _dbContext.Model;

        var expectedTableMappings = new Dictionary<Type, string>
        {
            { typeof(User), "User" },
            { typeof(Salesperson), "Salesperson" },
            { typeof(Hospital), "Hospital" },
            { typeof(HospitalAlias), "HospitalAlias" },
            { typeof(HospitalNameReview), "HospitalNameReview" },
            { typeof(ProductType), "ProductType" },
            { typeof(Product), "Product" },
            { typeof(ProductAlias), "ProductAlias" },
            { typeof(SalesmanNameReview), "SalesmanNameReview" },
            { typeof(SalesmanNameRule), "SalesmanNameRule" },
            { typeof(SalesmanNameRuleMember), "SalesmanNameRuleMember" },
            { typeof(SalesLine), "SalesLine" },
            { typeof(SalesLineCredit), "SalesLineCredit" },
            { typeof(ImportBatch), "ImportBatch" },
            { typeof(ImportIssue), "ImportIssue" },
            { typeof(SalesLineArchive), "SalesLineArchive" },
            { typeof(Region), "Region" },
            { typeof(ProvinceMapping), "ProvinceMapping" },
            { typeof(ProvinceAlias), "ProvinceAlias" },
            { typeof(Territory), "Territory" },
            { typeof(TerritoryAssignment), "TerritoryAssignment" },
            { typeof(TerritoryGroup), "TerritoryGroup" },
            { typeof(TerritoryGroupMember), "TerritoryGroupMember" },
            { typeof(HospitalTerritoryChange), "HospitalTerritoryChange" },
            { typeof(HospitalRegistry), "HospitalRegistry" },
            { typeof(HospitalPotentialMetric), "HospitalPotentialMetric" },
            { typeof(HospitalRegistryLink), "HospitalRegistryLink" },
            { typeof(TierWeight), "TierWeight" },
            { typeof(Target), "Target" },
            { typeof(TargetProductGroup), "TargetProductGroup" },
            { typeof(TargetRevision), "TargetRevision" },
            { typeof(ScoringWeight), "ScoringWeight" },
            { typeof(ScoringWeightRevision), "ScoringWeightRevision" },
            { typeof(EvaluationSetting), "EvaluationSetting" },
            { typeof(CoachingInsight), "CoachingInsight" }
        };

        foreach (var (type, tableName) in expectedTableMappings)
        {
            var entityType = model.FindEntityType(type);
            Assert.NotNull(entityType);
            Assert.Equal(tableName, entityType.GetTableName());
        }
    }

    [Fact]
    public void AppDbContext_Model_ShouldConfigureDecimalPrecisionsAccurately()
    {
        var model = _dbContext.Model;

        var salesLine = model.FindEntityType(typeof(SalesLine))!;
        Assert.Equal(14, salesLine.FindProperty(nameof(SalesLine.Qty))!.GetPrecision());
        Assert.Equal(2, salesLine.FindProperty(nameof(SalesLine.Qty))!.GetScale());
        Assert.Equal(14, salesLine.FindProperty(nameof(SalesLine.Total))!.GetPrecision());
        Assert.Equal(2, salesLine.FindProperty(nameof(SalesLine.Total))!.GetScale());

        var salesLineCredit = model.FindEntityType(typeof(SalesLineCredit))!;
        Assert.Equal(6, salesLineCredit.FindProperty(nameof(SalesLineCredit.SharePercent))!.GetPrecision());
        Assert.Equal(3, salesLineCredit.FindProperty(nameof(SalesLineCredit.SharePercent))!.GetScale());

        var metric = model.FindEntityType(typeof(HospitalPotentialMetric))!;
        Assert.Equal(16, metric.FindProperty(nameof(HospitalPotentialMetric.Value))!.GetPrecision());
        Assert.Equal(4, metric.FindProperty(nameof(HospitalPotentialMetric.Value))!.GetScale());

        var setting = model.FindEntityType(typeof(EvaluationSetting))!;
        Assert.Equal(6, setting.FindProperty(nameof(EvaluationSetting.TargetSuggestionAlpha))!.GetPrecision());
        Assert.Equal(3, setting.FindProperty(nameof(EvaluationSetting.TargetSuggestionAlpha))!.GetScale());
        Assert.Equal(5, setting.FindProperty(nameof(EvaluationSetting.MinRegionCoverage))!.GetPrecision());
        Assert.Equal(4, setting.FindProperty(nameof(EvaluationSetting.MinRegionCoverage))!.GetScale());
    }

    [Fact]
    public void AppDbContext_Model_ShouldConfigureDateColumnTypes()
    {
        var model = _dbContext.Model;

        var salesLine = model.FindEntityType(typeof(SalesLine))!;
        Assert.Equal("date", salesLine.FindProperty(nameof(SalesLine.InvoiceDate))!.GetColumnType());

        var territoryAssignment = model.FindEntityType(typeof(TerritoryAssignment))!;
        Assert.Equal("date", territoryAssignment.FindProperty(nameof(TerritoryAssignment.EffectiveFrom))!.GetColumnType());
    }

    [Fact]
    public void AppDbContext_Model_ShouldConfigureUniqueConstraints()
    {
        var model = _dbContext.Model;

        var user = model.FindEntityType(typeof(User))!;
        Assert.Contains(user.GetIndexes(), i => i.IsUnique && i.Properties.Any(p => p.Name == nameof(User.Email)));

        var salesperson = model.FindEntityType(typeof(Salesperson))!;
        Assert.Contains(salesperson.GetIndexes(), i => i.IsUnique && i.Properties.Any(p => p.Name == nameof(Salesperson.NameInFile)));

        var salesLine = model.FindEntityType(typeof(SalesLine))!;
        Assert.Contains(salesLine.GetIndexes(), i => i.IsUnique && i.Properties.Any(p => p.Name == nameof(SalesLine.RowKey)));

        var salesLineCredit = model.FindEntityType(typeof(SalesLineCredit))!;
        Assert.Contains(salesLineCredit.GetIndexes(), i => i.IsUnique &&
            i.Properties.Count == 2 &&
            i.Properties.Any(p => p.Name == nameof(SalesLineCredit.SalesLineId)) &&
            i.Properties.Any(p => p.Name == nameof(SalesLineCredit.SalespersonId)));

        var target = model.FindEntityType(typeof(Target))!;
        Assert.Contains(target.GetIndexes(), i => i.IsUnique &&
            i.Properties.Any(p => p.Name == nameof(Target.SalespersonId)));
    }

    [Fact]
    public void AppDbContext_Model_ShouldConfigureDeleteBehaviors()
    {
        var model = _dbContext.Model;

        var salesLineCredit = model.FindEntityType(typeof(SalesLineCredit))!;
        var salesLineFk = salesLineCredit.GetForeignKeys()
            .First(fk => fk.PrincipalEntityType.ClrType == typeof(SalesLine));
        Assert.Equal(DeleteBehavior.Cascade, salesLineFk.DeleteBehavior);

        var salespersonFk = salesLineCredit.GetForeignKeys()
            .First(fk => fk.PrincipalEntityType.ClrType == typeof(Salesperson));
        Assert.Equal(DeleteBehavior.Restrict, salespersonFk.DeleteBehavior);

        var hospitalAlias = model.FindEntityType(typeof(HospitalAlias))!;
        var hospitalFk = hospitalAlias.GetForeignKeys()
            .First(fk => fk.PrincipalEntityType.ClrType == typeof(Hospital));
        Assert.Equal(DeleteBehavior.Cascade, hospitalFk.DeleteBehavior);
    }
}
