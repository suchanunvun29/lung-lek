namespace SalesEvaluation.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class SalesLineConfiguration : IEntityTypeConfiguration<SalesLine>
{
    public void Configure(EntityTypeBuilder<SalesLine> builder)
    {
        builder.ToTable("SalesLine");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.InvoiceNo).IsRequired();
        builder.Property(s => s.InvoiceDate).HasColumnType("date");
        builder.Property(s => s.ExpiryDate).HasColumnType("date");

        builder.Property(s => s.Qty).HasPrecision(14, 2);
        builder.Property(s => s.UnitPrice).HasPrecision(14, 2);
        builder.Property(s => s.Amount).HasPrecision(14, 2);
        builder.Property(s => s.Vat).HasPrecision(14, 2);
        builder.Property(s => s.Total).HasPrecision(14, 2);

        builder.Property(s => s.RowKey).IsRequired();
        builder.HasIndex(s => s.RowKey).IsUnique();

        builder.Property(s => s.SourceSheetName).IsRequired();
        builder.Property(s => s.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(s => s.UpdatedAt).IsRequired();

        builder.HasIndex(s => new { s.SalespersonId, s.Year, s.Month });
        builder.HasIndex(s => new { s.HospitalId, s.InvoiceDate });
        builder.HasIndex(s => new { s.ProductTypeId, s.Year, s.Month });
        builder.HasIndex(s => new { s.Year, s.Month });
        builder.HasIndex(s => s.InvoiceNo);

        builder.HasOne(s => s.Hospital)
            .WithMany(h => h.SalesLines)
            .HasForeignKey(s => s.HospitalId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Salesperson)
            .WithMany(sp => sp.SalesLines)
            .HasForeignKey(s => s.SalespersonId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Product)
            .WithMany(p => p.SalesLines)
            .HasForeignKey(s => s.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ProductType)
            .WithMany(pt => pt.SalesLines)
            .HasForeignKey(s => s.ProductTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ImportBatch)
            .WithMany(ib => ib.SalesLines)
            .HasForeignKey(s => s.ImportBatchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SalesLineCreditConfiguration : IEntityTypeConfiguration<SalesLineCredit>
{
    public void Configure(EntityTypeBuilder<SalesLineCredit> builder)
    {
        builder.ToTable("SalesLineCredit");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.SharePercent).HasPrecision(6, 3);
        builder.Property(c => c.IsPrimary).HasDefaultValue(false);
        builder.Property(c => c.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(c => new { c.SalesLineId, c.SalespersonId }).IsUnique();
        builder.HasIndex(c => c.SalespersonId);

        builder.HasOne(c => c.SalesLine)
            .WithMany(s => s.Credits)
            .HasForeignKey(c => c.SalesLineId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Salesperson)
            .WithMany(s => s.Credits)
            .HasForeignKey(c => c.SalespersonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("ImportBatch");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.FileName).IsRequired();
        builder.Property(b => b.StartedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(b => b.Status).HasDefaultValue(ImportStatus.PROCESSING);
        builder.Property(b => b.Mode).HasDefaultValue(ImportMode.APPEND);
        builder.Property(b => b.TotalRows).HasDefaultValue(0);
        builder.Property(b => b.InsertedRows).HasDefaultValue(0);
        builder.Property(b => b.UpdatedRows).HasDefaultValue(0);
        builder.Property(b => b.SkippedRows).HasDefaultValue(0);
        builder.Property(b => b.ErrorRows).HasDefaultValue(0);
        builder.Property(b => b.RemovedRows).HasDefaultValue(0);

        builder.Property(b => b.SheetsFound).HasColumnType("jsonb");
        builder.Property(b => b.SheetsImported).HasColumnType("jsonb");
        builder.Property(b => b.PeriodsTouched).HasColumnType("jsonb");
        builder.Property(b => b.TargetPeriods).HasColumnType("jsonb");

        builder.HasOne(b => b.UploadedBy)
            .WithMany(u => u.ImportBatches)
            .HasForeignKey(b => b.UploadedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SalesLineArchiveConfiguration : IEntityTypeConfiguration<SalesLineArchive>
{
    public void Configure(EntityTypeBuilder<SalesLineArchive> builder)
    {
        builder.ToTable("SalesLineArchive");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.SalesLineId).IsRequired();
        builder.Property(a => a.RowKey).IsRequired();
        builder.Property(a => a.Total).HasPrecision(14, 2);
        builder.Property(a => a.Reason).IsRequired();
        builder.Property(a => a.RemovedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(a => a.Payload).HasColumnType("jsonb");

        builder.HasIndex(a => new { a.Year, a.Month });
        builder.HasIndex(a => a.RemovedByBatchId);

        builder.HasOne(a => a.RemovedByBatch)
            .WithMany(b => b.ArchivedLines)
            .HasForeignKey(a => a.RemovedByBatchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ImportIssueConfiguration : IEntityTypeConfiguration<ImportIssue>
{
    public void Configure(EntityTypeBuilder<ImportIssue> builder)
    {
        builder.ToTable("ImportIssue");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Level).IsRequired();
        builder.Property(i => i.Code).IsRequired();
        builder.Property(i => i.Message).IsRequired();
        builder.Property(i => i.RawRow).HasColumnType("jsonb");

        builder.HasIndex(i => new { i.ImportBatchId, i.Level });

        builder.HasOne(i => i.ImportBatch)
            .WithMany(b => b.Issues)
            .HasForeignKey(i => i.ImportBatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
