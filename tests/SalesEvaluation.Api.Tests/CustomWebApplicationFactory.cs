namespace SalesEvaluation.Api.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SalesEvaluation.Api.Converters;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Persistence;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    public static readonly JsonSerializerOptions DefaultJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new DecimalToStringConverter(), new NullableDecimalToStringConverter() }
    };

    private readonly string _dbName = Guid.NewGuid().ToString();

    public int ManagerUserId { get; } = 1;
    public int SalespersonUserId { get; } = 2;
    public int Salesperson2UserId { get; } = 3;
    public int MustChangePasswordUserId { get; } = 4;
    public int InactiveUserId { get; } = 5;

    public int ProductTypeId1 { get; } = 1;
    public int ProductTypeId2 { get; } = 2;
    public int ProductId1 { get; } = 1;
    public int ProductId2 { get; } = 2;
    public int ProductId3 { get; } = 3;
    public int ProductId4 { get; } = 4;

    public int SalespersonId1 { get; } = 1;
    public int SalespersonId2 { get; } = 2;
    public int SalespersonId3 { get; } = 3;

    public int TerritoryId1 { get; } = 1;
    public int TerritoryId2 { get; } = 2;

    public int HospitalId1 { get; } = 1;
    public int HospitalId2 { get; } = 2;
    public int HospitalId3 { get; } = 3;

    public int AliasId1 { get; } = 1;
    public int AliasId2 { get; } = 2;
    public int AliasId3 { get; } = 3;

    public int HospitalReviewId1 { get; } = 1;
    public int SalesmanReviewId1 { get; } = 1;
    public int SalesmanRuleId1 { get; } = 1;

    // Phase B seeds — territories, groups, provinces, registry and credited sales
    public int RegionId1 { get; } = 1;
    public int RegionId2 { get; } = 2;
    public int TerritoryGroupId1 { get; } = 1;
    public int GroupMemberId1 { get; } = 1;
    public int ProvinceMappingId1 { get; } = 1;
    public int ProvinceMappingId2 { get; } = 2;
    public int HospitalRegistryId1 { get; } = 1;
    public int HospitalRegistryId2 { get; } = 2;
    public int HospitalRegistryId3 { get; } = 3;
    public int HospitalRegistryId4 { get; } = 4;
    public int RegistryLinkId1 { get; } = 1;
    public int ImportBatchId1 { get; } = 1;
    public int SalesLineId1 { get; } = 1;
    public int SalesLineId2 { get; } = 2;
    public int SalesLineCreditId1 { get; } = 1;
    public int SalesLineCreditId2 { get; } = 2;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "super-secret-key-that-is-at-least-32-chars-long-123456",
                ["Jwt:Issuer"] = "SalesEvaluationApi",
                ["Jwt:Audience"] = "SalesEvaluationFrontend"
            });
        });

        builder.ConfigureServices(services =>
        {
            var descriptors = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                d.ServiceType == typeof(DbContextOptions) ||
                d.ServiceType == typeof(AppDbContext) ||
                d.ServiceType == typeof(IAppDbContext) ||
                (d.ServiceType.FullName != null && (
                    d.ServiceType.FullName.Contains("EntityFrameworkCore") ||
                    d.ServiceType.FullName.Contains("Npgsql")))).ToList();

            foreach (var descriptor in descriptors)
            {
                services.Remove(descriptor);
            }

            var inMemoryServiceProvider = new ServiceCollection()
                .AddEntityFrameworkInMemoryDatabase()
                .BuildServiceProvider();

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseInMemoryDatabase(_dbName);
                options.UseInternalServiceProvider(inMemoryServiceProvider);
            });

            services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
            SeedData(db);
        });
    }

    private void SeedData(AppDbContext db)
    {
        if (db.Users.Any()) return;

        var managerUser = new User
        {
            Id = ManagerUserId,
            Email = "manager@example.com",
            PasswordHash = "hash",
            DisplayName = "Manager User",
            Role = UserRole.MANAGER,
            IsActive = true,
            MustChangePassword = false
        };

        var salesUser = new User
        {
            Id = SalespersonUserId,
            Email = "sales@example.com",
            PasswordHash = "hash",
            DisplayName = "Salesperson User",
            Role = UserRole.SALESPERSON,
            IsActive = true,
            MustChangePassword = false
        };

        var salesUser2 = new User
        {
            Id = Salesperson2UserId,
            Email = "sales2@example.com",
            PasswordHash = "hash",
            DisplayName = "Salesperson 2 User",
            Role = UserRole.SALESPERSON,
            IsActive = true,
            MustChangePassword = false
        };

        var mustChangeUser = new User
        {
            Id = MustChangePasswordUserId,
            Email = "firstlogin@example.com",
            PasswordHash = "hash",
            DisplayName = "First Login User",
            Role = UserRole.MANAGER,
            IsActive = true,
            MustChangePassword = true
        };

        var inactiveUser = new User
        {
            Id = InactiveUserId,
            Email = "inactive@example.com",
            PasswordHash = "hash",
            DisplayName = "Inactive User",
            Role = UserRole.SALESPERSON,
            IsActive = false,
            MustChangePassword = false
        };

        db.Users.AddRange(managerUser, salesUser, salesUser2, mustChangeUser, inactiveUser);

        var ptB = new ProductType
        {
            Id = ProductTypeId1,
            Name = "B-Type (Consumables)"
        };

        var ptA = new ProductType
        {
            Id = ProductTypeId2,
            Name = "A-Type (Equipment)"
        };

        db.ProductTypes.AddRange(ptB, ptA);

        var prod1 = new Product
        {
            Id = ProductId1,
            Name = "Product Beta",
            ProductTypeId = ProductTypeId1,
            ProductType = ptB,
            Code = "CODE-BETA",
            DisplayName = "Beta Display",
            Source = ProductSource.SALES_HISTORY,
            IsActive = true
        };

        var prod2 = new Product
        {
            Id = ProductId2,
            Name = "Product Alpha",
            ProductTypeId = ProductTypeId1,
            ProductType = ptB,
            Code = null,
            DisplayName = null,
            Source = ProductSource.SALES_HISTORY,
            IsActive = true
        };

        var prod3 = new Product
        {
            Id = ProductId3,
            Name = "Product Equipment 1",
            ProductTypeId = ProductTypeId2,
            ProductType = ptA,
            Code = "CODE-EQ1",
            DisplayName = "Equipment 1 Display",
            Source = ProductSource.CATALOG,
            IsActive = false
        };

        var prod4 = new Product
        {
            Id = ProductId4,
            Name = "Product Delta",
            ProductTypeId = ProductTypeId2,
            ProductType = ptA,
            Code = "CODE-DELTA",
            DisplayName = "Delta Display",
            Source = ProductSource.CATALOG,
            IsActive = true
        };

        db.Products.AddRange(prod1, prod2, prod3, prod4);

        // Salespeople
        var sp1 = new Salesperson
        {
            Id = SalespersonId1,
            NameInFile = "SOMCHAI",
            DisplayName = "สมชาย",
            IsActive = true,
            UserId = SalespersonUserId,
            ExcludedFromTerritoryTotals = false,
            EmploymentEndedAt = null
        };

        var sp2 = new Salesperson
        {
            Id = SalespersonId2,
            NameInFile = "SOMSRI",
            DisplayName = "สมศรี",
            IsActive = true,
            UserId = null,
            ExcludedFromTerritoryTotals = false,
            EmploymentEndedAt = null
        };

        var sp3 = new Salesperson
        {
            Id = SalespersonId3,
            NameInFile = "DUPLICATE_SOMCHAI",
            DisplayName = "สมชาย (ซ้ำ)",
            IsActive = true,
            UserId = null,
            ExcludedFromTerritoryTotals = false,
            EmploymentEndedAt = null
        };

        db.Salespeople.AddRange(sp1, sp2, sp3);

        // Territories
        var terr1 = new Territory
        {
            Id = TerritoryId1,
            Name = "ภาคเหนือ",
            Code = "NORTH",
            RegionId = RegionId1,
            IsActive = true
        };

        var terr2 = new Territory
        {
            Id = TerritoryId2,
            Name = "ภาคกลาง",
            Code = "CENTRAL",
            RegionId = RegionId2,
            IsActive = true
        };

        db.Territories.AddRange(terr1, terr2);

        // Regions (Phase B)
        var region1 = new Region
        {
            Id = RegionId1,
            Name = "ภาคเหนือ",
            SortOrder = 1,
            CreatedAt = DateTime.UtcNow
        };

        var region2 = new Region
        {
            Id = RegionId2,
            Name = "ภาคกลาง",
            SortOrder = 2,
            CreatedAt = DateTime.UtcNow
        };

        db.Regions.AddRange(region1, region2);

        // Territory group with terr-1 as an open member
        var group1 = new TerritoryGroup
        {
            Id = TerritoryGroupId1,
            Name = "กลุ่มเขต A",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var groupMember1 = new TerritoryGroupMember
        {
            Id = GroupMemberId1,
            GroupId = TerritoryGroupId1,
            TerritoryId = TerritoryId1,
            EffectiveFrom = new DateOnly(2026, 1, 1),
            EffectiveTo = null,
            CreatedAt = DateTime.UtcNow
        };

        group1.Members.Add(groupMember1);
        db.TerritoryGroups.Add(group1);

        // Province mappings (Phase B)
        var pm1 = new ProvinceMapping
        {
            Id = ProvinceMappingId1,
            CanonicalName = "เชียงใหม่",
            RegionId = RegionId1,
            Region = region1,
            CreatedAt = DateTime.UtcNow
        };

        var pm2 = new ProvinceMapping
        {
            Id = ProvinceMappingId2,
            CanonicalName = "กรุงเทพมหานคร",
            RegionId = RegionId2,
            Region = region2,
            CreatedAt = DateTime.UtcNow
        };

        db.ProvinceMappings.AddRange(pm1, pm2);

        // Hospital registries (Phase B) — 1 never-sold GOVERNMENT_GENERAL candidate + noise
        var hreg1 = new HospitalRegistry
        {
            Id = HospitalRegistryId1,
            SourceCode = "10717",
            NameInFile = "รพ.เชียงใหม่ประจำจังหวัด",
            DisplayName = "โรงพยาบาลเชียงใหม่",
            ProvinceMappingId = ProvinceMappingId1,
            ProvinceMapping = pm1,
            ProvinceRaw = "เชียงใหม่",
            RegionId = RegionId1,
            Tier = "A",
            Category = HospitalCategory.GOVERNMENT_GENERAL,
            PotentialAdjustment = 1.000m,
            IsActive = true,
            TerritoryId = TerritoryId1,
            TerritorySource = TerritoryLinkSource.INFERRED
        };

        hreg1.Metrics.Add(new HospitalPotentialMetric
        {
            Id = 1,
            Metric = PotentialMetricKey.BEDS,
            Value = 100.5m,
            PeriodYear = 2025,
            PeriodMonth = null,
            CreatedAt = DateTime.UtcNow
        });

        hreg1.Metrics.Add(new HospitalPotentialMetric
        {
            Id = 2,
            Metric = PotentialMetricKey.CMI,
            Value = 3.25m,
            PeriodYear = 2025,
            PeriodMonth = null,
            CreatedAt = DateTime.UtcNow
        });

        var hreg2 = new HospitalRegistry
        {
            Id = HospitalRegistryId2,
            NameInFile = "รพ.ลำพูน",
            DisplayName = "โรงพยาบาลลำพูน",
            ProvinceMappingId = ProvinceMappingId1,
            ProvinceMapping = pm1,
            ProvinceRaw = "ลำพูน",
            RegionId = RegionId1,
            Tier = "B",
            Category = HospitalCategory.GOVERNMENT_GENERAL,
            PotentialAdjustment = 1.000m,
            IsActive = true,
            TerritoryId = TerritoryId1,
            TerritorySource = TerritoryLinkSource.INFERRED
        };

        var hreg3 = new HospitalRegistry
        {
            Id = HospitalRegistryId3,
            NameInFile = "รพ.เอกชนเหนือ",
            DisplayName = "โรงพยาบาลเอกชนเหนือ",
            ProvinceRaw = "เชียงใหม่",
            Category = HospitalCategory.PRIVATE,
            PotentialAdjustment = 1.000m,
            IsActive = true,
            TerritoryId = TerritoryId1
        };

        var hreg4 = new HospitalRegistry
        {
            Id = HospitalRegistryId4,
            NameInFile = "รพ.ปิดให้บริการ",
            DisplayName = "โรงพยาบาลปิดให้บริการ",
            ProvinceRaw = "ลำพูน",
            Category = HospitalCategory.GOVERNMENT_GENERAL,
            PotentialAdjustment = 1.000m,
            IsActive = false,
            TerritoryId = TerritoryId1
        };

        db.HospitalRegistries.AddRange(hreg1, hreg2, hreg3, hreg4);

        // Registry link — hosp-1 linked to hreg-1
        var rlink1 = new HospitalRegistryLink
        {
            Id = RegistryLinkId1,
            HospitalId = HospitalId1,
            HospitalRegistryId = HospitalRegistryId1,
            Status = RegistryLinkStatus.LINKED,
            Method = RegistryLinkMethod.EXACT,
            Confidence = 1.0000m,
            Note = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.HospitalRegistryLinks.Add(rlink1);

        // Import batch + credited sales lines for territory view tests
        var batch1 = new ImportBatch
        {
            Id = ImportBatchId1,
            FileName = "seed.xlsx",
            FileSizeBytes = 100,
            UploadedById = ManagerUserId,
            Status = ImportStatus.SUCCESS,
            Mode = ImportMode.APPEND,
            StartedAt = DateTime.UtcNow,
            FinishedAt = DateTime.UtcNow
        };

        db.ImportBatches.Add(batch1);

        var sl1 = new SalesLine
        {
            Id = SalesLineId1,
            InvoiceNo = "INV-2026-001",
            InvoiceDate = new DateOnly(2026, 1, 15),
            Year = 2026,
            Month = 1,
            HospitalId = HospitalId1,
            SalespersonId = SalespersonId1,
            ProductId = ProductId1,
            ProductTypeId = ProductTypeId1,
            Qty = 10,
            UnitPrice = 100,
            Amount = 1000,
            Vat = 70,
            Total = 1070,
            RowKey = "INV-2026-001|Product Beta||0",
            SourceSheetName = "Sheet1",
            SourceRowNumber = 2,
            ImportBatchId = ImportBatchId1
        };

        var sl2 = new SalesLine
        {
            Id = SalesLineId2,
            InvoiceNo = "INV-2025-001",
            InvoiceDate = new DateOnly(2025, 6, 20),
            Year = 2025,
            Month = 6,
            HospitalId = HospitalId3,
            SalespersonId = SalespersonId1,
            ProductId = ProductId1,
            ProductTypeId = ProductTypeId1,
            Qty = 5,
            UnitPrice = 100,
            Amount = 500,
            Vat = 35,
            Total = 535,
            RowKey = "INV-2025-001|Product Beta||0",
            SourceSheetName = "Sheet1",
            SourceRowNumber = 3,
            ImportBatchId = ImportBatchId1
        };

        db.SalesLines.AddRange(sl1, sl2);

        db.SalesLineCredits.AddRange(
            new SalesLineCredit
            {
                Id = SalesLineCreditId1,
                SalesLineId = SalesLineId1,
                SalespersonId = SalespersonId1,
                SharePercent = 100m,
                IsPrimary = true
            },
            new SalesLineCredit
            {
                Id = SalesLineCreditId2,
                SalesLineId = SalesLineId2,
                SalespersonId = SalespersonId1,
                SharePercent = 100m,
                IsPrimary = true
            });

        // Territory Assignments
        var ta1 = new TerritoryAssignment
        {
            Id = 1,
            TerritoryId = TerritoryId1,
            SalespersonId = SalespersonId1,
            IsSupervisor = true,
            EffectiveFrom = new DateOnly(2026, 1, 1),
            EffectiveTo = null
        };

        var ta2 = new TerritoryAssignment
        {
            Id = 2,
            TerritoryId = TerritoryId1,
            SalespersonId = SalespersonId2,
            IsSupervisor = false,
            EffectiveFrom = new DateOnly(2026, 1, 1),
            EffectiveTo = null
        };

        db.TerritoryAssignments.AddRange(ta1, ta2);

        // Hospitals
        var hosp1 = new Hospital
        {
            Id = HospitalId1,
            NameInFile = "โรงพยาบาลเชียงใหม่",
            DisplayName = "รพ.เชียงใหม่",
            Province = "เชียงใหม่",
            TerritoryId = TerritoryId1,
            TerritorySource = TerritoryLinkSource.MANUAL,
            ProvinceMappingId = ProvinceMappingId1,
            IsPreExistingCustomer = true
        };

        var hosp2 = new Hospital
        {
            Id = HospitalId2,
            NameInFile = "โรงพยาบาลศิริราช 1",
            DisplayName = "รพ.ศิริราช 1",
            Province = "กรุงเทพมหานคร",
            TerritoryId = null,
            TerritorySource = TerritoryLinkSource.INFERRED,
            IsPreExistingCustomer = false
        };

        var hosp3 = new Hospital
        {
            Id = HospitalId3,
            NameInFile = "โรงพยาบาลศิริราช 2",
            DisplayName = "รพ.ศิริราช 2",
            Province = "กรุงเทพมหานคร",
            TerritoryId = TerritoryId1,
            TerritorySource = TerritoryLinkSource.MANUAL,
            IsPreExistingCustomer = false
        };

        db.Hospitals.AddRange(hosp1, hosp2, hosp3);

        // Hospital Aliases
        var alias1 = new HospitalAlias
        {
            Id = AliasId1,
            NormalizedKey = "CHIANGMAI",
            SampleRaw = "รพ.เชียงใหม่",
            HospitalId = HospitalId1,
            Source = NameDecisionSource.AUTO,
            CreatedAt = DateTime.UtcNow
        };

        var alias2 = new HospitalAlias
        {
            Id = AliasId2,
            NormalizedKey = "SIRIRAJ_A",
            SampleRaw = "ศิริราช 1",
            HospitalId = HospitalId2,
            Source = NameDecisionSource.AUTO,
            CreatedAt = DateTime.UtcNow
        };

        var alias3 = new HospitalAlias
        {
            Id = AliasId3,
            NormalizedKey = "SIRIRAJ_B",
            SampleRaw = "ศิริราช 2",
            HospitalId = HospitalId3,
            Source = NameDecisionSource.AUTO,
            CreatedAt = DateTime.UtcNow
        };

        db.HospitalAliases.AddRange(alias1, alias2, alias3);

        // Hospital Name Review
        var hnr = new HospitalNameReview
        {
            Id = HospitalReviewId1,
            NormalizedKeyA = "SIRIRAJ_A",
            NormalizedKeyB = "SIRIRAJ_B",
            SampleRawA = "ศิริราช 1",
            SampleRawB = "ศิริราช 2",
            Similarity = 0.95m,
            Status = NameReviewStatus.PENDING,
            CreatedAt = DateTime.UtcNow
        };

        db.HospitalNameReviews.Add(hnr);

        // Salesman Name Review
        var snr = new SalesmanNameReview
        {
            Id = SalesmanReviewId1,
            PersonKey = "SOMCHAI_DUP",
            SampleRaw = "สมชาย ซ้ำ",
            Status = NameReviewStatus.PENDING,
            CreatedSalespersonId = SalespersonId3,
            CreatedAt = DateTime.UtcNow
        };

        db.SalesmanNameReviews.Add(snr);

        // Salesman Name Rule
        var snRule = new SalesmanNameRule
        {
            Id = SalesmanRuleId1,
            NormalizedRaw = "SOMCHAI/SOMSRI",
            SampleRaw = "สมชาย/สมศรี",
            DecidedById = ManagerUserId,
            DecidedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        var snMember1 = new SalesmanNameRuleMember
        {
            Id = 1,
            RuleId = SalesmanRuleId1,
            SalespersonId = SalespersonId1,
            SharePercent = 60m
        };

        var snMember2 = new SalesmanNameRuleMember
        {
            Id = 2,
            RuleId = SalesmanRuleId1,
            SalespersonId = SalespersonId2,
            SharePercent = 40m
        };

        snRule.Members.Add(snMember1);
        snRule.Members.Add(snMember2);

        db.SalesmanNameRules.Add(snRule);

        // Evaluation Setting singleton
        db.EvaluationSettings.Add(new EvaluationSetting
        {
            ChurnMonths = 6,
            MinMonthsForChurn = 3,
            MinMonthsForConsistency = 6,
            MinRegionCoverage = 0.50m,
            TargetSuggestionAlpha = 0.30m,
            TargetOutlierThreshold = 0.40m,
            TargetGrowthRate = 1.10m,
            AiEnabled = true,
            UpdatedAt = DateTime.UtcNow
        });

        // Scoring Weights
        db.ScoringWeights.AddRange(
            new ScoringWeight { Metric = KpiMetric.REVENUE_VS_TARGET, Weight = 40, UpdatedAt = DateTime.UtcNow },
            new ScoringWeight { Metric = KpiMetric.NEW_CUSTOMERS, Weight = 15, UpdatedAt = DateTime.UtcNow },
            new ScoringWeight { Metric = KpiMetric.PRODUCT_GROUP, Weight = 15, UpdatedAt = DateTime.UtcNow },
            new ScoringWeight { Metric = KpiMetric.RETENTION, Weight = 15, UpdatedAt = DateTime.UtcNow },
            new ScoringWeight { Metric = KpiMetric.CONSISTENCY, Weight = 15, UpdatedAt = DateTime.UtcNow }
        );

        // Tier Weights
        db.TierWeights.AddRange(
            new TierWeight { Tier = "A", Weight = 1.0m, UpdatedAt = DateTime.UtcNow },
            new TierWeight { Tier = "B", Weight = 0.8m, UpdatedAt = DateTime.UtcNow },
            new TierWeight { Tier = "C", Weight = 0.5m, UpdatedAt = DateTime.UtcNow }
        );

        db.SaveChanges();
    }

    public string CreateToken(int userId, UserRole role)
    {
        using var scope = Services.CreateScope();
        var tokenProvider = scope.ServiceProvider.GetRequiredService<IJwtTokenProvider>();
        return tokenProvider.GenerateToken(userId, role);
    }
}
