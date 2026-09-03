namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Kpi;
using SalesEvaluation.Contracts.Kpi;

// Module F2 (Territory KPI Rules ข้อ 12): every number comes from the territory-KPI service —
// these endpoints only assemble "target units", order them and strip fields per viewer.
public static class LeaderboardEndpoints
{
    private const string SpreadsheetContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/leaderboard/territories/export", HandleExportTerritoryLeaderboard);
        app.MapGet("/leaderboard/territories", HandleGetTerritoryLeaderboard);
        app.MapGet("/leaderboard/territories/{territoryId}/people", HandleGetTerritoryPeople);

        return app;
    }

    private static async Task<IResult> HandleGetTerritoryLeaderboard(
        HttpContext httpContext,
        ILeaderboardService leaderboardService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseQuery(httpContext, out var period, out var criteria, out var error))
        {
            return error!;
        }

        var user = currentUserService.User!;
        var result = await leaderboardService.BuildAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, period, criteria, ct);

        return Results.Json(new TerritoryLeaderboardResponse
        {
            Criteria = result.Criteria,
            Period = KpiScoringService.ToPeriodDto(result.Period),
            Ranked = result.Ranked,
            Unranked = result.Unranked,
            Buckets = result.Buckets
        });
    }

    // Export parity (Data Visibility Rules ข้อ 4/6): the file is written FROM the same serialized
    // rows the screen gets — restricted units contribute whitelist columns only.
    private static async Task<IResult> HandleExportTerritoryLeaderboard(
        HttpContext httpContext,
        ILeaderboardService leaderboardService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseQuery(httpContext, out var period, out var criteria, out var error))
        {
            return error!;
        }

        var user = currentUserService.User!;
        var result = await leaderboardService.BuildAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, period, criteria, ct);

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Leaderboard");
        var headers = new[] { "หน่วยเป้า", "ผู้ดูแล", "อันดับ", "คะแนนรวม", "คิดจาก", "ยอดขาย", "เป้า", "% ถึงเป้า", "เกณฑ์ที่ใช้จัดอันดับ" };
        for (var i = 0; i < headers.Length; i++)
        {
            sheet.Cell(1, i + 1).Value = headers[i];
        }

        sheet.Column(1).Width = 30;
        sheet.Column(2).Width = 28;
        sheet.Column(3).Width = 8;
        sheet.Column(4).Width = 12;
        sheet.Column(5).Width = 22;
        sheet.Column(6).Width = 16;
        sheet.Column(7).Width = 16;
        sheet.Column(8).Width = 12;
        sheet.Column(9).Width = 18;

        var rowNumber = 2;
        foreach (var unitObject in result.Ranked)
        {
            WriteUnitRow(sheet, ref rowNumber, unitObject, criteria, indent: false, memberPrefix: "· ");
        }

        foreach (var unitObject in result.Unranked)
        {
            WriteUnitRow(sheet, ref rowNumber, unitObject, criteria, indent: false, memberPrefix: "· ");
        }

        // Bucket blocks are MANAGER-only in the payload, so they can only land in the manager's file.
        if (result.Buckets != null)
        {
            var buckets = result.Buckets;
            var personalTargets = buckets.PersonalBucketEntries.Sum(entry => entry.PersonalTarget);
            WriteCell(sheet, rowNumber, 1, "personalBucket");
            WriteCell(sheet, rowNumber, 2, buckets.PersonalBucketEntries.Count > 0
                ? string.Join(", ", buckets.PersonalBucketEntries.Select(entry => entry.DisplayName))
                : "—");
            WriteCell(sheet, rowNumber, 6, buckets.PersonalBucket);
            if (personalTargets > 0)
            {
                WriteCell(sheet, rowNumber, 7, personalTargets);
                WriteCell(sheet, rowNumber, 8, buckets.PersonalBucket / personalTargets * 100.0);
            }

            rowNumber++;
            WriteCell(sheet, rowNumber, 1, "unassignedBucket");
            WriteCell(sheet, rowNumber, 2, $"ไม่มีเขต {buckets.UnassignedHospitalCount} โรงพยาบาล");
            WriteCell(sheet, rowNumber, 6, buckets.UnassignedBucket);
            rowNumber++;
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return Results.File(
            stream.ToArray(),
            SpreadsheetContentType,
            fileDownloadName: $"leaderboard-{criteria}-{period.PeriodType}-{period.Year}-{period.PeriodNumber}.xlsx");
    }

    private static void WriteUnitRow(IXLWorksheet sheet, ref int rowNumber, object unitObject, string criteria, bool indent, string memberPrefix)
    {
        var row = rowNumber;
        void SetText(int column, string? value)
        {
            if (!string.IsNullOrEmpty(value))
            {
                sheet.Cell(row, column).Value = value;
            }
        }

        void SetNumber(int column, double? value)
        {
            if (value.HasValue)
            {
                sheet.Cell(row, column).Value = value.Value;
            }
        }

        List<object>? members = null;

        switch (unitObject)
        {
            case LeaderboardTerritoryFullUnitDto full:
                SetText(1, indent ? $"— {full.Name}" : full.Name);
                SetText(2, string.Join(", ", full.OwnerNames));
                SetNumber(3, full.Rank);
                SetNumber(4, full.CompositeScore);
                SetText(5, full.ComputedMetricLabel);
                SetNumber(6, full.Revenue);
                // territory rows carry target/targetLabel; the label wins when present.
                if (!string.IsNullOrEmpty(full.TargetLabel))
                {
                    SetText(7, full.TargetLabel);
                }
                else
                {
                    SetNumber(7, full.Target);
                }

                SetNumber(8, full.AchievementPercent);
                SetText(9, criteria);
                members = full.Members;
                break;
            case LeaderboardGroupFullUnitDto group:
                SetText(1, indent ? $"— {group.Name}" : group.Name);
                SetText(2, string.Join(", ", group.OwnerNames));
                SetNumber(3, group.Rank);
                SetNumber(4, group.CompositeScore);
                SetText(5, group.ComputedMetricLabel);
                SetNumber(6, group.Revenue);
                SetNumber(7, group.RevenueTarget);
                SetNumber(8, group.AchievementPercent);
                SetText(9, criteria);
                members = group.Members;
                break;
            case LeaderboardRankOnlyUnitDto rankOnly:
                SetText(1, indent ? $"— {rankOnly.Name}" : rankOnly.Name);
                SetText(2, string.Join(", ", rankOnly.OwnerNames));
                SetNumber(3, rankOnly.Rank);
                SetNumber(4, rankOnly.CompositeScore);
                SetText(5, rankOnly.ComputedMetricLabel);
                SetText(9, criteria);
                members = rankOnly.Members;
                break;
        }

        rowNumber++;
        WriteMemberRows(sheet, ref rowNumber, members);
    }

    private static void WriteMemberRows(IXLWorksheet sheet, ref int rowNumber, List<object>? members)
    {
        if (members == null)
        {
            return;
        }

        foreach (var memberObject in members)
        {
            var memberRow = rowNumber;
            switch (memberObject)
            {
                case TerritoryKpiFullRowDto full:
                    sheet.Cell(memberRow, 1).Value = $"· {full.Name}";
                    sheet.Cell(memberRow, 2).Value = string.Join(", ", full.OwnerNames);
                    if (full.CompositeScore.HasValue)
                    {
                        sheet.Cell(memberRow, 4).Value = full.CompositeScore.Value;
                    }

                    sheet.Cell(memberRow, 5).Value = full.ComputedMetricLabel;
                    sheet.Cell(memberRow, 6).Value = full.Revenue;
                    if (!string.IsNullOrEmpty(full.TargetLabel))
                    {
                        sheet.Cell(memberRow, 7).Value = full.TargetLabel;
                    }
                    else if (full.Target.HasValue)
                    {
                        sheet.Cell(memberRow, 7).Value = full.Target.Value;
                    }

                    if (full.AchievementPercent.HasValue)
                    {
                        sheet.Cell(memberRow, 8).Value = full.AchievementPercent.Value;
                    }

                    break;
                case TerritoryKpiRankOnlyRowDto rankOnly:
                    sheet.Cell(memberRow, 1).Value = $"· {rankOnly.Name}";
                    sheet.Cell(memberRow, 2).Value = string.Join(", ", rankOnly.OwnerNames);
                    if (rankOnly.CompositeScore.HasValue)
                    {
                        sheet.Cell(memberRow, 4).Value = rankOnly.CompositeScore.Value;
                    }

                    sheet.Cell(memberRow, 5).Value = rankOnly.ComputedMetricLabel;
                    break;
            }

            rowNumber++;
        }
    }

    private static void WriteCell(IXLWorksheet sheet, int row, int column, string value) => sheet.Cell(row, column).Value = value;

    private static void WriteCell(IXLWorksheet sheet, int row, int column, double value) => sheet.Cell(row, column).Value = value;

    // ---------- Tier 2 — people within one territory ----------

    private static async Task<IResult> HandleGetTerritoryPeople(
        int territoryId,
        HttpContext httpContext,
        ILeaderboardService leaderboardService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseQuery(httpContext, out var period, out var criteria, out var error))
        {
            return error!;
        }

        var user = currentUserService.User!;
        var result = await leaderboardService.GetTerritoryPeopleAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, territoryId, period, criteria, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
        }

        return Results.Json(result);
    }

    private static bool TryParseQuery(HttpContext httpContext, out Application.Common.AppPeriodKey period, out string criteria, out IResult? error)
    {
        criteria = string.Empty;
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out period, out error))
        {
            return false;
        }

        if (!PeriodQueryParser.TryParseCriteria(httpContext.Request.Query, out criteria, out error))
        {
            return false;
        }

        return true;
    }
}
