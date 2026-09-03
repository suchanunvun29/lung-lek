namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Common;

/// <summary>
/// Builds ClosedXML workbooks for the two report types currently implemented:
/// individual coaching report and team overview.
/// Lives in Application as interface; ClosedXML implementation in Infrastructure.
/// </summary>
public interface IExcelReportService
{
    /// <summary>GET /reports/individual/:salespersonId — individual coaching workbook.</summary>
    Task<byte[]> BuildIndividualReportAsync(string salespersonId, AppPeriodKey period, CancellationToken cancellationToken = default);

    /// <summary>GET /reports/team-overview — team overview workbook.</summary>
    Task<byte[]> BuildTeamOverviewReportAsync(AppPeriodKey period, List<string>? visibleSalespersonIds, CancellationToken cancellationToken = default);
}
