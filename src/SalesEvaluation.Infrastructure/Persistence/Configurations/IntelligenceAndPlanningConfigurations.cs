namespace SalesEvaluation.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class HospitalRegistryConfiguration : IEntityTypeConfiguration<HospitalRegistry>
{
    public void Configure(EntityTypeBuilder<HospitalRegistry> builder)
    {
        builder.ToTable("HospitalRegistry");

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();

        builder.HasIndex(h => h.SourceCode).IsUnique();
        builder.Property(h => h.NameInFile).IsRequired();
        builder.Property(h => h.DisplayName).IsRequired();
        builder.Property(h => h.ProvinceRaw).IsRequired();
        builder.Property(h => h.Category).HasDefaultValue(HospitalCategory.GOVERNMENT_GENERAL);
        builder.Property(h => h.PotentialAdjustment).HasPrecision(6, 3).HasDefaultValue(1.000m);
        builder.Property(h => h.IsActive).HasDefaultValue(true);
        builder.Property(h => h.TerritorySource).HasDefaultValue(TerritoryLinkSource.INFERRED);
        builder.Property(h => h.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(h => h.UpdatedAt).IsRequired();

        builder.HasIndex(h => new { h.NameInFile, h.ProvinceRaw }).IsUnique();
        builder.HasIndex(h => h.RegionId);
        builder.HasIndex(h => new { h.Category, h.Tier });

        builder.HasOne(h => h.Region)
            .WithMany(r => r.RegistryHospitals)
            .HasForeignKey(h => h.RegionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(h => h.ProvinceMapping)
            .WithMany(p => p.RegistryHospitals)
            .HasForeignKey(h => h.ProvinceMappingId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(h => h.Territory)
            .WithMany(t => t.RegistryHospitals)
            .HasForeignKey(h => h.TerritoryId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class HospitalPotentialMetricConfiguration : IEntityTypeConfiguration<HospitalPotentialMetric>
{
    public void Configure(EntityTypeBuilder<HospitalPotentialMetric> builder)
    {
        builder.ToTable("HospitalPotentialMetric");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.HospitalRegistryId).IsRequired();
        builder.Property(m => m.Metric).IsRequired();
        builder.Property(m => m.Value).HasPrecision(16, 4);
        builder.Property(m => m.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(m => new { m.HospitalRegistryId, m.Metric, m.PeriodYear, m.PeriodMonth }).IsUnique();

        builder.HasOne(m => m.HospitalRegistry)
            .WithMany(h => h.Metrics)
            .HasForeignKey(m => m.HospitalRegistryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class HospitalRegistryLinkConfiguration : IEntityTypeConfiguration<HospitalRegistryLink>
{
    public void Configure(EntityTypeBuilder<HospitalRegistryLink> builder)
    {
        builder.ToTable("HospitalRegistryLink");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();

        builder.Property(l => l.HospitalId).IsRequired();
        builder.HasIndex(l => l.HospitalId).IsUnique();

        builder.Property(l => l.Status).HasDefaultValue(RegistryLinkStatus.UNREVIEWED);
        builder.Property(l => l.Confidence).HasPrecision(5, 4);
        builder.Property(l => l.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(l => l.UpdatedAt).IsRequired();

        builder.HasIndex(l => l.Status);

        builder.HasOne(l => l.Hospital)
            .WithOne(h => h.RegistryLink)
            .HasForeignKey<HospitalRegistryLink>(l => l.HospitalId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.HospitalRegistry)
            .WithMany(h => h.Links)
            .HasForeignKey(l => l.HospitalRegistryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(l => l.ReviewedBy)
            .WithMany(u => u.RegistryLinkReviews)
            .HasForeignKey(l => l.ReviewedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class TierWeightConfiguration : IEntityTypeConfiguration<TierWeight>
{
    public void Configure(EntityTypeBuilder<TierWeight> builder)
    {
        builder.ToTable("TierWeight");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Tier).IsRequired();
        builder.HasIndex(t => t.Tier).IsUnique();

        builder.Property(t => t.Weight).HasPrecision(6, 3).HasDefaultValue(1.000m);
        builder.Property(t => t.UpdatedAt).IsRequired();
    }
}

public class TargetConfiguration : IEntityTypeConfiguration<Target>
{
    public void Configure(EntityTypeBuilder<Target> builder)
    {
        builder.ToTable("Target");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Scope).HasDefaultValue(TargetScope.SALESPERSON);
        builder.Property(t => t.RevenueTarget).HasPrecision(14, 2).HasDefaultValue(0m);
        builder.Property(t => t.NewCustomerTarget).HasDefaultValue(0);
        builder.Property(t => t.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(t => t.UpdatedAt).IsRequired();

        builder.HasIndex(t => new { t.SalespersonId, t.Year, t.Month }).IsUnique();
        builder.HasIndex(t => new { t.TerritoryId, t.Year, t.Month }).IsUnique();
        builder.HasIndex(t => new { t.TerritoryGroupId, t.Year, t.Month }).IsUnique();
        builder.HasIndex(t => new { t.Year, t.Month });

        builder.HasOne(t => t.Territory)
            .WithMany(x => x.Targets)
            .HasForeignKey(t => t.TerritoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.TerritoryGroup)
            .WithMany(g => g.Targets)
            .HasForeignKey(t => t.TerritoryGroupId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Salesperson)
            .WithMany(s => s.Targets)
            .HasForeignKey(t => t.SalespersonId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class TargetProductGroupConfiguration : IEntityTypeConfiguration<TargetProductGroup>
{
    public void Configure(EntityTypeBuilder<TargetProductGroup> builder)
    {
        builder.ToTable("TargetProductGroup");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.TargetId).IsRequired();
        builder.Property(p => p.ProductTypeId).IsRequired();
        builder.Property(p => p.RevenueTarget).HasPrecision(14, 2);

        builder.HasIndex(p => new { p.TargetId, p.ProductTypeId }).IsUnique();

        builder.HasOne(p => p.Target)
            .WithMany(t => t.ProductGroupTargets)
            .HasForeignKey(p => p.TargetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.ProductType)
            .WithMany(pt => pt.TargetProductGroups)
            .HasForeignKey(p => p.ProductTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class TargetRevisionConfiguration : IEntityTypeConfiguration<TargetRevision>
{
    public void Configure(EntityTypeBuilder<TargetRevision> builder)
    {
        builder.ToTable("TargetRevision");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.TargetId).IsRequired();
        builder.Property(r => r.ChangeType).IsRequired();
        builder.Property(r => r.Before).HasColumnType("jsonb");
        builder.Property(r => r.After).HasColumnType("jsonb");
        builder.Property(r => r.ChangedById).IsRequired();
        builder.Property(r => r.ChangedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(r => new { r.TargetId, r.ChangedAt });

        builder.HasOne(r => r.Target)
            .WithMany(t => t.Revisions)
            .HasForeignKey(r => r.TargetId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ChangedBy)
            .WithMany(u => u.TargetRevisions)
            .HasForeignKey(r => r.ChangedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ScoringWeightConfiguration : IEntityTypeConfiguration<ScoringWeight>
{
    public void Configure(EntityTypeBuilder<ScoringWeight> builder)
    {
        builder.ToTable("ScoringWeight");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).ValueGeneratedNever();

        builder.Property(w => w.Metric).IsRequired();
        builder.HasIndex(w => w.Metric).IsUnique();

        builder.Property(w => w.Weight).IsRequired();
        builder.Property(w => w.UpdatedAt).IsRequired();
    }
}

public class ScoringWeightRevisionConfiguration : IEntityTypeConfiguration<ScoringWeightRevision>
{
    public void Configure(EntityTypeBuilder<ScoringWeightRevision> builder)
    {
        builder.ToTable("ScoringWeightRevision");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.Before).HasColumnType("jsonb").IsRequired();
        builder.Property(r => r.After).HasColumnType("jsonb").IsRequired();
        builder.Property(r => r.ChangedById).IsRequired();
        builder.Property(r => r.ChangedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(r => r.ChangedBy)
            .WithMany(u => u.WeightRevisions)
            .HasForeignKey(r => r.ChangedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class EvaluationSettingConfiguration : IEntityTypeConfiguration<EvaluationSetting>
{
    public void Configure(EntityTypeBuilder<EvaluationSetting> builder)
    {
        builder.ToTable("EvaluationSetting");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever().HasDefaultValue("singleton");

        builder.Property(e => e.ChurnMonths).HasDefaultValue(6);
        builder.Property(e => e.MinMonthsForChurn).HasDefaultValue(6);
        builder.Property(e => e.MinMonthsForConsistency).HasDefaultValue(6);
        builder.Property(e => e.AiEnabled).HasDefaultValue(true);
        builder.Property(e => e.AiAnonymize).HasDefaultValue(true);
        builder.Property(e => e.PotentialMetric).HasDefaultValue(PotentialMetricKey.BEDS);
        builder.Property(e => e.MinRegionCoverage).HasPrecision(5, 4).HasDefaultValue(0.50m);
        builder.Property(e => e.TargetSuggestionAlpha).HasPrecision(6, 3).HasDefaultValue(1.000m);
        builder.Property(e => e.TargetLookbackMonths).HasDefaultValue(3);
        builder.Property(e => e.TargetOutlierThreshold).HasPrecision(5, 4).HasDefaultValue(0.40m);
        builder.Property(e => e.TargetGrowthRate).HasPrecision(6, 3).HasDefaultValue(1.000m);
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasOne(e => e.UpdatedBy)
            .WithMany(u => u.SettingUpdates)
            .HasForeignKey(e => e.UpdatedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class CoachingInsightConfiguration : IEntityTypeConfiguration<CoachingInsight>
{
    public void Configure(EntityTypeBuilder<CoachingInsight> builder)
    {
        builder.ToTable("CoachingInsight");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.SalespersonId).IsRequired();
        builder.Property(c => c.PeriodType).IsRequired();
        builder.Property(c => c.Year).IsRequired();
        builder.Property(c => c.PeriodNumber).IsRequired();
        builder.Property(c => c.KpiSnapshot).HasColumnType("jsonb").IsRequired();
        builder.Property(c => c.Status).HasDefaultValue(InsightStatus.PENDING);
        builder.Property(c => c.IsStale).HasDefaultValue(false);
        builder.Property(c => c.GeneratedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(c => new { c.SalespersonId, c.PeriodType, c.Year, c.PeriodNumber }).IsUnique();
        builder.HasIndex(c => new { c.Year, c.PeriodType });

        builder.HasOne(c => c.Salesperson)
            .WithMany(s => s.Insights)
            .HasForeignKey(c => c.SalespersonId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.GeneratedBy)
            .WithMany(u => u.GeneratedInsights)
            .HasForeignKey(c => c.GeneratedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
