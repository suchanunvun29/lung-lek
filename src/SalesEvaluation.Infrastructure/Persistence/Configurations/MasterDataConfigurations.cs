namespace SalesEvaluation.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class HospitalConfiguration : IEntityTypeConfiguration<Hospital>
{
    public void Configure(EntityTypeBuilder<Hospital> builder)
    {
        builder.ToTable("Hospital");

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();

        builder.Property(h => h.NameInFile).IsRequired();
        builder.HasIndex(h => h.NameInFile).IsUnique();

        builder.Property(h => h.DisplayName).IsRequired();
        builder.Property(h => h.IsPreExistingCustomer).HasDefaultValue(false);
        builder.Property(h => h.TerritorySource).HasDefaultValue(TerritoryLinkSource.INFERRED);
        builder.Property(h => h.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(h => h.UpdatedAt).IsRequired();

        builder.HasOne(h => h.Territory)
            .WithMany(t => t.Hospitals)
            .HasForeignKey(h => h.TerritoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(h => h.ProvinceMapping)
            .WithMany(p => p.Hospitals)
            .HasForeignKey(h => h.ProvinceMappingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ProductTypeConfiguration : IEntityTypeConfiguration<ProductType>
{
    public void Configure(EntityTypeBuilder<ProductType> builder)
    {
        builder.ToTable("ProductType");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Name).IsRequired();
        builder.HasIndex(p => p.Name).IsUnique();

        builder.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Product");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Name).IsRequired();
        builder.Property(p => p.ProductTypeId).IsRequired();
        builder.Property(p => p.Source).HasDefaultValue(ProductSource.SALES_HISTORY);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(p => p.Code).IsUnique();
        builder.HasIndex(p => new { p.Name, p.ProductTypeId }).IsUnique();

        builder.HasOne(p => p.ProductType)
            .WithMany(t => t.Products)
            .HasForeignKey(p => p.ProductTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProductAliasConfiguration : IEntityTypeConfiguration<ProductAlias>
{
    public void Configure(EntityTypeBuilder<ProductAlias> builder)
    {
        builder.ToTable("ProductAlias");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.NormalizedKey).IsRequired();
        builder.HasIndex(a => a.NormalizedKey).IsUnique();

        builder.Property(a => a.SampleRaw).IsRequired();
        builder.Property(a => a.ProductId).IsRequired();
        builder.Property(a => a.Source).IsRequired();
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(a => a.ProductId);

        builder.HasOne(a => a.Product)
            .WithMany(p => p.Aliases)
            .HasForeignKey(a => a.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.DecidedBy)
            .WithMany(u => u.ProductAliases)
            .HasForeignKey(a => a.DecidedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class HospitalAliasConfiguration : IEntityTypeConfiguration<HospitalAlias>
{
    public void Configure(EntityTypeBuilder<HospitalAlias> builder)
    {
        builder.ToTable("HospitalAlias");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.NormalizedKey).IsRequired();
        builder.HasIndex(a => a.NormalizedKey).IsUnique();

        builder.Property(a => a.SampleRaw).IsRequired();
        builder.Property(a => a.HospitalId).IsRequired();
        builder.Property(a => a.Source).IsRequired();
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(a => a.HospitalId);

        builder.HasOne(a => a.Hospital)
            .WithMany(h => h.Aliases)
            .HasForeignKey(a => a.HospitalId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.DecidedBy)
            .WithMany(u => u.HospitalAliases)
            .HasForeignKey(a => a.DecidedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class HospitalNameReviewConfiguration : IEntityTypeConfiguration<HospitalNameReview>
{
    public void Configure(EntityTypeBuilder<HospitalNameReview> builder)
    {
        builder.ToTable("HospitalNameReview");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.NormalizedKeyA).IsRequired();
        builder.Property(r => r.NormalizedKeyB).IsRequired();
        builder.Property(r => r.SampleRawA).IsRequired();
        builder.Property(r => r.SampleRawB).IsRequired();
        builder.Property(r => r.Similarity).HasPrecision(5, 4);
        builder.Property(r => r.Status).HasDefaultValue(NameReviewStatus.PENDING);
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(r => new { r.NormalizedKeyA, r.NormalizedKeyB }).IsUnique();
        builder.HasIndex(r => r.Status);

        builder.HasOne(r => r.MergedInto)
            .WithMany(h => h.NameReviews)
            .HasForeignKey(r => r.MergedIntoId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.DecidedBy)
            .WithMany(u => u.HospitalNameReviews)
            .HasForeignKey(r => r.DecidedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SalesmanNameReviewConfiguration : IEntityTypeConfiguration<SalesmanNameReview>
{
    public void Configure(EntityTypeBuilder<SalesmanNameReview> builder)
    {
        builder.ToTable("SalesmanNameReview");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.PersonKey).IsRequired();
        builder.HasIndex(r => r.PersonKey).IsUnique();

        builder.Property(r => r.SampleRaw).IsRequired();
        builder.Property(r => r.Status).HasDefaultValue(NameReviewStatus.PENDING);
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(r => r.CreatedSalespersonId).IsUnique();
        builder.HasIndex(r => r.Status);

        builder.HasOne(r => r.CreatedSalesperson)
            .WithMany(s => s.NameReviewsCreated)
            .HasForeignKey(r => r.CreatedSalespersonId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.MergedInto)
            .WithMany(s => s.NameReviewsMergedInto)
            .HasForeignKey(r => r.MergedIntoId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.DecidedBy)
            .WithMany(u => u.SalesmanNameReviews)
            .HasForeignKey(r => r.DecidedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SalesmanNameRuleConfiguration : IEntityTypeConfiguration<SalesmanNameRule>
{
    public void Configure(EntityTypeBuilder<SalesmanNameRule> builder)
    {
        builder.ToTable("SalesmanNameRule");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();

        builder.Property(r => r.NormalizedRaw).IsRequired();
        builder.HasIndex(r => r.NormalizedRaw).IsUnique();

        builder.Property(r => r.SampleRaw).IsRequired();
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(r => r.DecidedBy)
            .WithMany(u => u.SalesmanNameRules)
            .HasForeignKey(r => r.DecidedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SalesmanNameRuleMemberConfiguration : IEntityTypeConfiguration<SalesmanNameRuleMember>
{
    public void Configure(EntityTypeBuilder<SalesmanNameRuleMember> builder)
    {
        builder.ToTable("SalesmanNameRuleMember");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();

        builder.Property(m => m.RuleId).IsRequired();
        builder.Property(m => m.SalespersonId).IsRequired();
        builder.Property(m => m.SharePercent).HasPrecision(6, 3);

        builder.HasIndex(m => new { m.RuleId, m.SalespersonId }).IsUnique();

        builder.HasOne(m => m.Rule)
            .WithMany(r => r.Members)
            .HasForeignKey(m => m.RuleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Salesperson)
            .WithMany(s => s.NameRuleMemberships)
            .HasForeignKey(m => m.SalespersonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
