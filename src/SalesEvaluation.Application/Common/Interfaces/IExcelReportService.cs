namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Reports;

/// <summary>
/// Builds reports (JSON DTOs and ClosedXML workbooks) for coaching reports,
/// team overview, and territory overview.
/// Lives in Application as interface; ClosedXML implementation in Infrastructure.
/// </summary>
public interface IExcelReportService
{
    /// <summary>Shared assembler for GET /reports/individual/:salespersonId (JSON) and Excel export.</summary>
    Task<IndividualReportResponse> AssembleIndividualReportAsync(int salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /reports/individual/:salespersonId/export — individual coaching workbook.</summary>
    Task<byte[]> BuildIndividualReportAsync(int salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>Shared assembler for GET /reports/team-overview (JSON) and Excel export.</summary>
    Task<TeamOverviewResponse> AssembleTeamOverviewReportAsync(AppPeriodKey period, List<int>? visibleSalespersonIds, CancellationToken cancellationToken = default);

    /// <summary>GET /reports/team-overview/export — team overview workbook.</summary>
    Task<byte[]> BuildTeamOverviewReportAsync(AppPeriodKey period, List<int>? visibleSalespersonIds, CancellationToken cancellationToken = default);

    /// <summary>GET /reports/territory-overview/export — territory overview workbook.</summary>
    Task<byte[]> BuildTerritoryOverviewReportAsync(AppPeriodKey period, HashSet<int>? visibleTerritoryIds, CancellationToken cancellationToken = default);
}
