namespace SalesEvaluation.Infrastructure.Excel;

using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Contracts.Reports;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

/// <summary>
/// Ports backend/src/services/report.service.ts using ClosedXML (instead of ExcelJS).
/// Implements buildIndividualReportWorkbook, buildTeamOverviewWorkbook, and buildTerritoryOverviewWorkbook
/// with shared assemblers for JSON routes.
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
    private readonly ITerritoryKpiService _territoryKpiService;

    public ExcelReportService(
        IAppDbContext dbContext,
        IKpiScoringService kpiService,
        ITerritoryKpiService territoryKpiService)
    {
        _dbContext = dbContext;
        _kpiService = kpiService;
        _territoryKpiService = territoryKpiService;
    }

    // -----------------------------------------------------------------------
    //  WACC-P0-001: Individual Report Assembler & Excel Builder
    // -----------------------------------------------------------------------

    public async Task<IndividualReportResponse> AssembleIndividualReportAsync(
        int salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .Where(s => s.Id == salespersonId)
            .Select(s => new { s.Id, s.DisplayName })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Salesperson not found");

        var prevPeriod = PeriodUtils.PreviousPeriod(period);

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

        ReportCoachingInsightDto? insightDto = null;
        if (coachingInsight != null)
        {
            object? snapshotObj = null;
            if (!string.IsNullOrEmpty(coachingInsight.KpiSnapshot))
            {
                try
                {
                    snapshotObj = System.Text.Json.JsonSerializer.Deserialize<object>(coachingInsight.KpiSnapshot);
                }
                catch
                {
                    snapshotObj = coachingInsight.KpiSnapshot;
                }
            }

            insightDto = new ReportCoachingInsightDto
            {
                Id = coachingInsight.Id,
                SalespersonId = coachingInsight.SalespersonId,
                PeriodType = coachingInsight.PeriodType.ToString(),
                Year = coachingInsight.Year,
                PeriodNumber = coachingInsight.PeriodNumber,
                KpiSnapshot = snapshotObj,
                ContentTh = coachingInsight.ContentTh,
                Status = coachingInsight.Status.ToString(),
                Provider = coachingInsight.Provider,
                Model = coachingInsight.Model,
                ErrorMessage = coachingInsight.ErrorMessage,
                IsStale = coachingInsight.IsStale,
                GeneratedById = coachingInsight.GeneratedById,
                GeneratedAt = coachingInsight.GeneratedAt.ToString("o")
            };
        }

        return new IndividualReportResponse
        {
            Salesperson = new EntitySummaryDto { Id = salesperson.Id, DisplayName = salesperson.DisplayName },
            Period = new PeriodKeyDto { PeriodType = period.PeriodType.ToString(), Year = period.Year, PeriodNumber = period.PeriodNumber },
            PreviousPeriod = new PeriodKeyDto { PeriodType = prevPeriod.PeriodType.ToString(), Year = prevPeriod.Year, PeriodNumber = prevPeriod.PeriodNumber },
            Composite = composite,
            PreviousComposite = previousComposite,
            Supplementary = salespersonKpi?.Supplementary ?? new SupplementaryKpisDto(),
            CoachingInsight = insightDto
        };
    }

    public async Task<byte[]> BuildIndividualReportAsync(
        int salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default)
    {
        var data = await AssembleIndividualReportAsync(salespersonId, period, cancellationToken);

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("รายงานรายบุคคล");

        sheet.Column(1).Width = 32;
        sheet.Column(2).Width = 20;
        sheet.Column(3).Width = 20;
        sheet.Column(4).Width = 20;
        sheet.Column(5).Width = 40;

        var row = 1;
        sheet.Cell(row, 1).Value = $"รายงาน Coaching: {data.Salesperson.DisplayName}";
        row++;
        sheet.Cell(row, 1).Value = $"งวด: {PeriodLabel(period)}";
        row += 2; // blank

        sheet.Cell(row, 1).Value = "คะแนนรวม";
        sheet.Cell(row, 2).Value = ScoreCell(data.Composite.Composite);
        sheet.Cell(row, 3).Value = data.Composite.ComputedFromLabel ?? string.Empty;
        row++;

        var prevPeriod = PeriodUtils.PreviousPeriod(period);
        sheet.Cell(row, 1).Value = $"คะแนนรวมงวดก่อน ({PeriodLabel(prevPeriod)})";
        sheet.Cell(row, 2).Value = ScoreCell(data.PreviousComposite.Composite);
        sheet.Cell(row, 3).Value = data.PreviousComposite.ComputedFromLabel ?? string.Empty;
        row += 2; // blank

        // KPI metrics header
        sheet.Cell(row, 1).Value = "ตัวชี้วัด (KPI)";
        sheet.Cell(row, 2).Value = "คะแนน";
        sheet.Cell(row, 3).Value = "ผลจริง";
        sheet.Cell(row, 4).Value = "เป้า";
        sheet.Cell(row, 5).Value = "หมายเหตุ";
        row++;

        foreach (var m in data.Composite.Metrics)
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

        if (data.Supplementary != null)
        {
            sheet.Cell(row, 1).Value = "ลูกค้าที่มีการซื้อในงวด (Active)";
            sheet.Cell(row, 2).Value = data.Supplementary.ActiveCustomers?.Count ?? 0;
            row++;

            sheet.Cell(row, 1).Value = "ลูกค้าที่ไม่มียอดซื้อในงวด (Churned)";
            sheet.Cell(row, 2).Value = data.Supplementary.ChurnedCustomers?.Count ?? 0;
            row++;

            sheet.Cell(row, 1).Value = "Product Penetration (กลุ่มสินค้าเฉลี่ย/ลูกค้า)";
            var avgPen = data.Supplementary.ProductPenetration?.AvgDistinctProductTypesPerCustomer ?? 0;
            sheet.Cell(row, 2).Value = Math.Round(avgPen * 100, MidpointRounding.AwayFromZero) / 100;
            row++;

            // Top hospitals sub-table
            if (data.Supplementary.RevenueShareByHospital?.Count > 0)
            {
                row++;
                sheet.Cell(row, 1).Value = "สัดส่วนยอดขายตามโรงพยาบาล (5 อันดับแรก)";
                sheet.Cell(row, 2).Value = "ยอดขาย";
                sheet.Cell(row, 3).Value = "สัดส่วน (%)";
                row++;

                foreach (var h in data.Supplementary.RevenueShareByHospital.Take(5))
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

        if (data.CoachingInsight?.ContentTh != null)
        {
            sheet.Cell(row, 1).Value = data.CoachingInsight.ContentTh;
        }
        else
        {
            sheet.Cell(row, 1).Value = "ยังไม่ได้สร้างสรุปจุดแข็ง/จุดที่ควรพัฒนาสำหรับงวดนี้";
        }

        return WorkbookToBytes(workbook);
    }

    // -----------------------------------------------------------------------
    //  WACC-P0-002: Team Overview Assembler & Excel Builder
    // -----------------------------------------------------------------------

    public async Task<TeamOverviewResponse> AssembleTeamOverviewReportAsync(
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

        return new TeamOverviewResponse
        {
            Period = new PeriodKeyDto { PeriodType = period.PeriodType.ToString(), Year = period.Year, PeriodNumber = period.PeriodNumber },
            Results = sorted.Select(e => new TeamOverviewEntryDto
            {
                Salesperson = new EntitySummaryDto { Id = e.Id, DisplayName = e.DisplayName },
                Composite = e.Composite
            }).ToList()
        };
    }

    public async Task<byte[]> BuildTeamOverviewReportAsync(
        AppPeriodKey period, List<int>? visibleSalespersonIds, CancellationToken cancellationToken = default)
    {
        var data = await AssembleTeamOverviewReportAsync(period, visibleSalespersonIds, cancellationToken);

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

        for (int i = 0; i < data.Results.Count; i++)
        {
            var entry = data.Results[i];
            var isRanked = entry.Composite.Composite.HasValue;
            sheet.Cell(row, 1).Value = isRanked ? i + 1 : (XLCellValue)"-";
            sheet.Cell(row, 2).Value = entry.Salesperson.DisplayName;
            sheet.Cell(row, 3).Value = ScoreCell(entry.Composite.Composite);
            sheet.Cell(row, 4).Value = isRanked
                ? entry.Composite.ComputedFromLabel ?? string.Empty
                : entry.Composite.Message ?? string.Empty;
            row++;
        }

        return WorkbookToBytes(workbook);
    }

    // -----------------------------------------------------------------------
    //  WACC-P0-004: Territory Overview Excel Builder
    // -----------------------------------------------------------------------

    public async Task<byte[]> BuildTerritoryOverviewReportAsync(
        AppPeriodKey period, HashSet<int>? visibleTerritoryIds, CancellationToken cancellationToken = default)
    {
        var fullRows = await _territoryKpiService.BuildFullTerritoryRowsAsync(period, cancellationToken);
        var groupRows = await _territoryKpiService.BuildTerritoryGroupRowsAsync(fullRows, period, cancellationToken);

        // Group members belong under groups per Business Rule G
        var groupMemberIds = groupRows.SelectMany(g => g.MemberTerritoryIds).ToHashSet();
        var fullRowsById = fullRows.ToDictionary(r => r.TerritoryId);

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("ภาพรวมเขตการขาย");

        sheet.Column(1).Width = 8;
        sheet.Column(2).Width = 30;
        sheet.Column(3).Width = 26;
        sheet.Column(4).Width = 18;
        sheet.Column(5).Width = 18;
        sheet.Column(6).Width = 16;
        sheet.Column(7).Width = 16;
        sheet.Column(8).Width = 32;

        var row = 1;
        sheet.Cell(row, 1).Value = $"ภาพรวมเขตการขาย — งวด {PeriodLabel(period)}";
        row += 2; // blank

        sheet.Cell(row, 1).Value = "ลำดับ";
        sheet.Cell(row, 2).Value = "เขต / กลุ่มเขต";
        sheet.Cell(row, 3).Value = "ผู้ดูแล";
        sheet.Cell(row, 4).Value = "ยอดขาย";
        sheet.Cell(row, 5).Value = "เป้าหมาย";
        sheet.Cell(row, 6).Value = "บรรลุเป้า (%)";
        sheet.Cell(row, 7).Value = "คะแนนรวม";
        sheet.Cell(row, 8).Value = "หมายเหตุ";
        row++;

        // 1. Render Territory Groups first (if any)
        foreach (var groupRow in groupRows)
        {
            var serializedObj = _territoryKpiService.SerializeGroupRow(groupRow, visibleTerritoryIds);
            var isFull = serializedObj is TerritoryGroupKpiFullRowDto;
            var fullGroup = serializedObj as TerritoryGroupKpiFullRowDto;
            var rankGroup = serializedObj as TerritoryGroupKpiRankOnlyRowDto;

            sheet.Cell(row, 1).Value = groupRow.Rank > 0 ? groupRow.Rank : (XLCellValue)"-";
            sheet.Cell(row, 2).Value = $"[กลุ่ม] {groupRow.Name}";
            sheet.Cell(row, 3).Value = string.Join(", ", groupRow.OwnerNames);

            if (isFull && fullGroup != null)
            {
                sheet.Cell(row, 4).Value = fullGroup.Revenue;
                sheet.Cell(row, 5).Value = fullGroup.RevenueTarget.HasValue ? fullGroup.RevenueTarget.Value : (XLCellValue)"-";
                sheet.Cell(row, 6).Value = fullGroup.AchievementPercent.HasValue ? $"{Math.Round(fullGroup.AchievementPercent.Value, 1):F1}%" : "-";
                sheet.Cell(row, 7).Value = ScoreCell(fullGroup.CompositeScore);
                sheet.Cell(row, 8).Value = fullGroup.ComputedMetricLabel;
            }
            else if (rankGroup != null)
            {
                sheet.Cell(row, 4).Value = "-";
                sheet.Cell(row, 5).Value = "-";
                sheet.Cell(row, 6).Value = "-";
                sheet.Cell(row, 7).Value = ScoreCell(rankGroup.CompositeScore);
                sheet.Cell(row, 8).Value = rankGroup.ComputedMetricLabel;
            }
            row++;

            // Detail members of the group
            foreach (var memberId in groupRow.MemberTerritoryIds)
            {
                if (fullRowsById.TryGetValue(memberId, out var memberRow))
                {
                    var serializedMember = _territoryKpiService.SerializeRow(memberRow, visibleTerritoryIds);
                    var isMemberFull = serializedMember is TerritoryKpiFullRowDto;
                    var fullMember = serializedMember as TerritoryKpiFullRowDto;
                    var rankMember = serializedMember as TerritoryKpiRankOnlyRowDto;

                    sheet.Cell(row, 1).Value = "-";
                    sheet.Cell(row, 2).Value = $"  • {memberRow.Name}";
                    sheet.Cell(row, 3).Value = string.Join(", ", memberRow.OwnerNames);

                    if (isMemberFull && fullMember != null)
                    {
                        sheet.Cell(row, 4).Value = fullMember.Revenue;
                        sheet.Cell(row, 5).Value = fullMember.Target.HasValue ? fullMember.Target.Value : (XLCellValue)(fullMember.TargetLabel ?? "-");
                        sheet.Cell(row, 6).Value = fullMember.AchievementPercent.HasValue ? $"{Math.Round(fullMember.AchievementPercent.Value, 1):F1}%" : "-";
                        sheet.Cell(row, 7).Value = ScoreCell(fullMember.CompositeScore);
                        sheet.Cell(row, 8).Value = fullMember.Message ?? fullMember.ComputedMetricLabel;
                    }
                    else if (rankMember != null)
                    {
                        sheet.Cell(row, 4).Value = "-";
                        sheet.Cell(row, 5).Value = "-";
                        sheet.Cell(row, 6).Value = "-";
                        sheet.Cell(row, 7).Value = ScoreCell(rankMember.CompositeScore);
                        sheet.Cell(row, 8).Value = rankMember.ComputedMetricLabel;
                    }
                    row++;
                }
            }
        }

        // 2. Render Independent Territories (not in any group)
        var independentTerritories = fullRows.Where(r => !groupMemberIds.Contains(r.TerritoryId)).ToList();
        foreach (var terrRow in independentTerritories)
        {
            var serializedObj = _territoryKpiService.SerializeRow(terrRow, visibleTerritoryIds);
            var isFull = serializedObj is TerritoryKpiFullRowDto;
            var fullTerr = serializedObj as TerritoryKpiFullRowDto;
            var rankTerr = serializedObj as TerritoryKpiRankOnlyRowDto;

            sheet.Cell(row, 1).Value = terrRow.Rank > 0 ? terrRow.Rank : (XLCellValue)"-";
            sheet.Cell(row, 2).Value = terrRow.Name;
            sheet.Cell(row, 3).Value = string.Join(", ", terrRow.OwnerNames);

            if (isFull && fullTerr != null)
            {
                sheet.Cell(row, 4).Value = fullTerr.Revenue;
                sheet.Cell(row, 5).Value = fullTerr.Target.HasValue ? fullTerr.Target.Value : (XLCellValue)(fullTerr.TargetLabel ?? "-");
                sheet.Cell(row, 6).Value = fullTerr.AchievementPercent.HasValue ? $"{Math.Round(fullTerr.AchievementPercent.Value, 1):F1}%" : "-";
                sheet.Cell(row, 7).Value = ScoreCell(fullTerr.CompositeScore);
                sheet.Cell(row, 8).Value = fullTerr.Message ?? fullTerr.ComputedMetricLabel;
            }
            else if (rankTerr != null)
            {
                sheet.Cell(row, 4).Value = "-";
                sheet.Cell(row, 5).Value = "-";
                sheet.Cell(row, 6).Value = "-";
                sheet.Cell(row, 7).Value = ScoreCell(rankTerr.CompositeScore);
                sheet.Cell(row, 8).Value = rankTerr.ComputedMetricLabel;
            }
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
