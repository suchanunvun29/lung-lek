namespace SalesEvaluation.Infrastructure.Excel;

using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.CoachingInsights;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Domain.Enums;

/// <summary>
/// Ports backend/src/services/report.service.ts using ClosedXML (instead of ExcelJS).
/// Implements buildIndividualReportWorkbook and buildTeamOverviewWorkbook with the same
/// sheet structure, column widths, and Thai labels.
/// </summary>
public class ExcelReportService : IExcelReportService
{
    private static readonly Dictionary<string, string> MetricLabelTh = new()
    {
        { "REVENUE_VS_TARGET", "ยอดขายเทียบเป้า" },
        { "NEW_CUSTOMERS", "ลูกค้าใหม่" },
        { "PRODUCT_GROUP", "การขายตามกลุ่มสินค้าที่ตั้งเป้า" },
        { "RETENTION", "การรักษาลูกค้าเดิม" },
        { "CONSISTENCY", "ความสม่ำเสมอของยอดขาย" },
    };

    private static readonly Dictionary<string, string> PeriodTypeLabelTh = new()
    {
        { "MONTH", "เดือน" },
        { "QUARTER", "ไตรมาส" },
        { "YEAR", "ปี" },
    };

    private readonly IAppDbContext _dbContext;
    private readonly IKpiScoringService _kpiService;

    public ExcelReportService(IAppDbContext dbContext, IKpiScoringService kpiService)
    {
        _dbContext = dbContext;
        _kpiService = kpiService;
    }

    public async Task<byte[]> BuildIndividualReportAsync(
        int salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .Where(s => s.Id == salespersonId)
            .Select(s => new { s.Id, s.DisplayName })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Salesperson not found");

        var prevPeriod = PeriodUtils.PreviousPeriod(period);
        var settings = await _kpiService.GetEvaluationSettingsAsync(cancellationToken);

        var composite = await _kpiService.ComputeCompositeScoreAsync(salespersonId, period, cancellationToken);
        var previousComposite = await _kpiService.ComputeCompositeScoreAsync(salespersonId, prevPeriod, cancellationToken);
        var salespersonKpi = await _kpiService.GetSalespersonKpiAsync(salespersonId, period, cancellationToken);

        var coachingInsight = await _dbContext.CoachingInsights
            .AsNoTracking()
            .FirstOrDefaultAsync(ci =>
                ci.SalespersonId == salespersonId &&
                ci.PeriodType == period.PeriodType &&
                ci.Year == period.Year &&
                ci.PeriodNumber == period.PeriodNumber, cancellationToken);

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("รายงานรายบุคคล");

        sheet.Column(1).Width = 32;
        sheet.Column(2).Width = 20;
        sheet.Column(3).Width = 20;
        sheet.Column(4).Width = 20;
        sheet.Column(5).Width = 40;

        var row = 1;
        sheet.Cell(row, 1).Value = $"รายงาน Coaching: {salesperson.DisplayName}";
        row++;
        sheet.Cell(row, 1).Value = $"งวด: {PeriodLabel(period)}";
        row += 2; // blank

        sheet.Cell(row, 1).Value = "คะแนนรวม";
        sheet.Cell(row, 2).Value = ScoreCell(composite.Composite);
        sheet.Cell(row, 3).Value = composite.ComputedFromLabel ?? string.Empty;
        row++;

        sheet.Cell(row, 1).Value = $"คะแนนรวมงวดก่อน ({PeriodLabel(prevPeriod)})";
        sheet.Cell(row, 2).Value = ScoreCell(previousComposite.Composite);
        sheet.Cell(row, 3).Value = previousComposite.ComputedFromLabel ?? string.Empty;
        row += 2; // blank

        // KPI metrics header
        sheet.Cell(row, 1).Value = "ตัวชี้วัด (KPI)";
        sheet.Cell(row, 2).Value = "คะแนน";
        sheet.Cell(row, 3).Value = "ผลจริง";
        sheet.Cell(row, 4).Value = "เป้า";
        sheet.Cell(row, 5).Value = "หมายเหตุ";
        row++;

        foreach (var m in composite.Metrics)
        {
            sheet.Cell(row, 1).Value = MetricLabelTh.GetValueOrDefault(m.Metric.ToString(), m.Metric.ToString());
            sheet.Cell(row, 2).Value = ScoreCell(m.Score);
            sheet.Cell(row, 3).Value = TryGetDetailValue(m.Detail, "actual");
            sheet.Cell(row, 4).Value = TryGetDetailValue(m.Detail, "target");
            sheet.Cell(row, 5).Value = m.Reason ?? string.Empty;
            row++;
        }

        row += 2; // blank

        // Supplementary KPIs section
        sheet.Cell(row, 1).Value = "ข้อมูลประกอบการประเมิน";
        row++;

        if (salespersonKpi != null)
        {
            sheet.Cell(row, 1).Value = "ลูกค้าที่มีการซื้อในงวด (Active)";
            sheet.Cell(row, 2).Value = salespersonKpi.Supplementary.ActiveCustomers.Count;
            row++;

            sheet.Cell(row, 1).Value = "ลูกค้าที่ไม่มียอดซื้อในงวด (Churned)";
            sheet.Cell(row, 2).Value = salespersonKpi.Supplementary.ChurnedCustomers.Count;
            row++;

            sheet.Cell(row, 1).Value = "Product Penetration (กลุ่มสินค้าเฉลี่ย/ลูกค้า)";
            sheet.Cell(row, 2).Value = Math.Round(salespersonKpi.Supplementary.ProductPenetration.AvgDistinctProductTypesPerCustomer * 100, MidpointRounding.AwayFromZero) / 100;
            row++;

            // Top hospitals sub-table
            if (salespersonKpi.Supplementary.RevenueShareByHospital.Count > 0)
            {
                row++;
                sheet.Cell(row, 1).Value = "สัดส่วนยอดขายตามโรงพยาบาล (5 อันดับแรก)";
                sheet.Cell(row, 2).Value = "ยอดขาย";
                sheet.Cell(row, 3).Value = "สัดส่วน (%)";
                row++;

                foreach (var h in salespersonKpi.Supplementary.RevenueShareByHospital.Take(5))
                {
                    sheet.Cell(row, 1).Value = h.HospitalName;
                    sheet.Cell(row, 2).Value = h.Revenue;
                    sheet.Cell(row, 3).Value = $"{Math.Round(h.SharePercent, 1):F1}%";
                    row++;
                }
            }
        }

        row += 2; // blank

        // Coaching insight text section
        sheet.Cell(row, 1).Value = "คำแนะนำ / สรุปจุดแข็ง-จุดที่ควรพัฒนา";
        row++;

        if (coachingInsight?.ContentTh != null)
        {
            sheet.Cell(row, 1).Value = coachingInsight.ContentTh;
        }
        else
        {
            sheet.Cell(row, 1).Value = "ยังไม่ได้สร้างสรุปจุดแข็ง/จุดที่ควรพัฒนาสำหรับงวดนี้";
        }

        return WorkbookToBytes(workbook);
    }

    public async Task<byte[]> BuildTeamOverviewReportAsync(
        AppPeriodKey period, List<int>? visibleSalespersonIds, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Salespeople.AsNoTracking().Where(s => s.IsActive);
        if (visibleSalespersonIds != null)
            query = query.Where(s => visibleSalespersonIds.Contains(s.Id));

        var salespeople = await query.OrderBy(s => s.DisplayName).ToListAsync(cancellationToken);

        var entries = new List<(int Id, string DisplayName, CompositeScoreResultDto Composite)>();
        foreach (var sp in salespeople)
        {
            var c = await _kpiService.ComputeCompositeScoreAsync(sp.Id, period, cancellationToken);
            entries.Add((sp.Id, sp.DisplayName, c));
        }

        // Sort: ranked (non-null composite ascending) first, unranked appended
        var ranked = entries.Where(e => e.Composite.Composite.HasValue)
            .OrderBy(e => e.Composite.Composite!.Value).ToList();
        var unranked = entries.Where(e => !e.Composite.Composite.HasValue).ToList();
        var sorted = ranked.Concat(unranked).ToList();

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("ภาพรวมทีม");

        sheet.Column(1).Width = 8;
        sheet.Column(2).Width = 28;
        sheet.Column(3).Width = 16;
        sheet.Column(4).Width = 30;

        var row = 1;
        sheet.Cell(row, 1).Value = $"ภาพรวมทีม — งวด {PeriodLabel(period)}";
        row++;
        sheet.Cell(row, 1).Value = "เรียงจากผู้ที่ควรได้รับการช่วยเหลือก่อน (คะแนนรวมต่ำสุดก่อน)";
        row += 2; // blank

        sheet.Cell(row, 1).Value = "ลำดับ";
        sheet.Cell(row, 2).Value = "ชื่อ";
        sheet.Cell(row, 3).Value = "คะแนนรวม";
        sheet.Cell(row, 4).Value = "หมายเหตุ";
        row++;

        for (int i = 0; i < sorted.Count; i++)
        {
            var entry = sorted[i];
            var isRanked = entry.Composite.Composite.HasValue;
            sheet.Cell(row, 1).Value = isRanked ? i + 1 : (XLCellValue)"-";
            sheet.Cell(row, 2).Value = entry.DisplayName;
            sheet.Cell(row, 3).Value = ScoreCell(entry.Composite.Composite);
            sheet.Cell(row, 4).Value = isRanked
                ? entry.Composite.ComputedFromLabel ?? string.Empty
                : entry.Composite.Message ?? string.Empty;
            row++;
        }

        return WorkbookToBytes(workbook);
    }

    // -----------------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------------

    private static string PeriodLabel(AppPeriodKey period)
    {
        if (period.PeriodType == PeriodType.YEAR)
            return $"ปี {period.Year}";
        var label = PeriodTypeLabelTh.GetValueOrDefault(period.PeriodType.ToString(), period.PeriodType.ToString());
        return $"{label} {period.PeriodNumber}/{period.Year}";
    }

    private static XLCellValue ScoreCell(double? score)
        => score == null ? (XLCellValue)"N/A" : (XLCellValue)(Math.Round(score.Value * 100, MidpointRounding.AwayFromZero) / 100);

    private static XLCellValue TryGetDetailValue(Dictionary<string, object?> detail, string key)
    {
        if (!detail.TryGetValue(key, out var val) || val == null) return "-";
        if (val is double d) return (XLCellValue)d;
        if (val is int i) return (XLCellValue)i;
        if (val is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Number)
        {
            try { return (XLCellValue)el.GetDouble(); }
            catch { return "-"; }
        }
        return val.ToString() is { Length: > 0 } s ? (XLCellValue)s : (XLCellValue)"-";
    }

    private static byte[] WorkbookToBytes(XLWorkbook workbook)
    {
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}
