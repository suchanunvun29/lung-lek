namespace SalesEvaluation.Application.CoachingInsights;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Kpi;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

/// <summary>
/// Ports backend/src/services/coachingInsight.service.ts.
/// - BuildKpiSummaryPayloadAsync: assembles the payload from IKpiScoringService
/// - AnonymizePayload: PII masking for salesperson and hospital names before sending to Gemini
/// - BuildRuleBasedSummary: Thai-language fallback text
/// - GenerateInsightAsync: upserts CoachingInsight with Gemini or rule-based content
/// </summary>
public class CoachingInsightService : ICoachingInsightService
{
    private const int TopHospitalsLimit = 5;
    private const string SalespersonAnonymizedLabel = "พนักงานขาย A";
    private const double TrendThreshold = 1.0;

    internal static readonly Dictionary<string, string> MetricLabelTh = new()
    {
        { "REVENUE_VS_TARGET", "ยอดขายเทียบเป้า" },
        { "NEW_CUSTOMERS", "ลูกค้าใหม่" },
        { "PRODUCT_GROUP", "การขายตามกลุ่มสินค้าที่ตั้งเป้า" },
        { "RETENTION", "การรักษาลูกค้าเดิม" },
        { "CONSISTENCY", "ความสม่ำเสมอของยอดขาย" },
    };

    private readonly IAppDbContext _dbContext;
    private readonly IKpiScoringService _kpiService;
    private readonly ITerritoryScopeResolver _scopeResolver;
    private readonly IGeminiService _geminiService;

    public CoachingInsightService(
        IAppDbContext dbContext,
        IKpiScoringService kpiService,
        ITerritoryScopeResolver scopeResolver,
        IGeminiService geminiService)
    {
        _dbContext = dbContext;
        _kpiService = kpiService;
        _scopeResolver = scopeResolver;
        _geminiService = geminiService;
    }

    public async Task<CoachingInsightResponse> GetInsightAsync(
        string salespersonId,
        AppPeriodKey period,
        CurrentUserRef viewer,
        CancellationToken cancellationToken = default)
    {
        var canView = await _scopeResolver.CanViewSalespersonAsync(viewer, salespersonId, cancellationToken);
        if (!canView)
            throw new UnauthorizedAccessException("Forbidden");

        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .Where(s => s.Id == salespersonId)
            .Select(s => new { s.Id, s.DisplayName })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Salesperson not found");

        var insight = await _dbContext.CoachingInsights
            .AsNoTracking()
            .FirstOrDefaultAsync(ci =>
                ci.SalespersonId == salespersonId &&
                ci.PeriodType == period.PeriodType &&
                ci.Year == period.Year &&
                ci.PeriodNumber == period.PeriodNumber, cancellationToken);

        // canGenerate: MANAGER (sees all) or supervised territory assignment active today
        var scope = await _scopeResolver.ResolveViewerTerritoryScopeAsync(viewer, cancellationToken);
        bool canGenerate;
        if (scope.CanSeeAllTerritories)
        {
            canGenerate = true;
        }
        else if (scope.SupervisedTerritoryIds.Count > 0)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            canGenerate = await _dbContext.TerritoryAssignments
                .AnyAsync(ta =>
                    ta.SalespersonId == salespersonId &&
                    scope.SupervisedTerritoryIds.Contains(ta.TerritoryId) &&
                    ta.EffectiveFrom <= today &&
                    (ta.EffectiveTo == null || ta.EffectiveTo >= today), cancellationToken);
        }
        else
        {
            canGenerate = false;
        }

        return new CoachingInsightResponse
        {
            Salesperson = new SalespersonRef { Id = salesperson.Id, DisplayName = salesperson.DisplayName },
            Period = new AppPeriodKeyDto
            {
                PeriodType = period.PeriodType.ToString(),
                Year = period.Year,
                PeriodNumber = period.PeriodNumber,
            },
            Insight = insight == null ? null : MapInsight(insight),
            CanGenerate = canGenerate,
        };
    }

    public async Task<CoachingInsightDto> GenerateInsightAsync(
        string salespersonId,
        AppPeriodKey period,
        string generatedById,
        CancellationToken cancellationToken = default)
    {
        var settings = await _kpiService.GetEvaluationSettingsAsync(cancellationToken);
        var rawPayload = await BuildKpiSummaryPayloadAsync(salespersonId, period, cancellationToken);
        var outboundPayload = settings.AiAnonymize ? AnonymizePayload(rawPayload) : rawPayload;
        var fallbackContent = BuildRuleBasedSummary(rawPayload);

        InsightStatus status = InsightStatus.SUCCESS;
        string? contentTh = fallbackContent;
        string? provider = "rule-based";
        string? model = null;
        string? errorMessage = null;
        bool sentToGemini = false;

        if (settings.AiEnabled)
        {
            try
            {
                var result = await _geminiService.CallAsync(BuildGeminiPrompt(outboundPayload), cancellationToken);
                contentTh = result.ContentTh;
                provider = "gemini";
                model = result.Model;
                sentToGemini = true;
            }
            catch (Exception ex)
            {
                status = InsightStatus.FAILED;
                contentTh = fallbackContent;
                provider = null;
                model = null;
                errorMessage = ex.Message;
            }
        }

        var kpiSnapshot = JsonSerializer.Serialize(
            new { payload = outboundPayload, sentToGemini },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        // Upsert by (salespersonId, periodType, year, periodNumber)
        var existing = await _dbContext.CoachingInsights
            .FirstOrDefaultAsync(ci =>
                ci.SalespersonId == salespersonId &&
                ci.PeriodType == period.PeriodType &&
                ci.Year == period.Year &&
                ci.PeriodNumber == period.PeriodNumber, cancellationToken);

        if (existing == null)
        {
            existing = new CoachingInsight
            {
                Id = NewId(),
                SalespersonId = salespersonId,
                PeriodType = period.PeriodType,
                Year = period.Year,
                PeriodNumber = period.PeriodNumber,
                KpiSnapshot = kpiSnapshot,
                ContentTh = contentTh,
                Status = status,
                Provider = provider,
                Model = model,
                ErrorMessage = errorMessage,
                IsStale = false,
                GeneratedById = generatedById,
                GeneratedAt = DateTime.UtcNow,
            };
            _dbContext.CoachingInsights.Add(existing);
        }
        else
        {
            existing.KpiSnapshot = kpiSnapshot;
            existing.ContentTh = contentTh;
            existing.Status = status;
            existing.Provider = provider;
            existing.Model = model;
            existing.ErrorMessage = errorMessage;
            existing.IsStale = false;
            existing.GeneratedById = generatedById;
            existing.GeneratedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return MapInsight(existing);
    }

    // -----------------------------------------------------------------------
    //  KPI payload assembly (mirrors buildKpiSummaryPayload from TS)
    // -----------------------------------------------------------------------

    internal async Task<KpiSummaryPayload> BuildKpiSummaryPayloadAsync(
        string salespersonId, AppPeriodKey period, CancellationToken cancellationToken)
    {
        var salesperson = await _dbContext.Salespeople
            .AsNoTracking()
            .Where(s => s.Id == salespersonId)
            .Select(s => new { s.Id, s.DisplayName })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Salesperson not found");

        var settings = await _kpiService.GetEvaluationSettingsAsync(cancellationToken);
        var prevPeriod = PeriodUtils.PreviousPeriod(period);

        var composite = await _kpiService.ComputeCompositeScoreAsync(salespersonId, period, cancellationToken);
        var previousComposite = await _kpiService.ComputeCompositeScoreAsync(salespersonId, prevPeriod, cancellationToken);
        var salespersonKpi = await _kpiService.GetSalespersonKpiAsync(salespersonId, period, cancellationToken);
        var allComposites = await _kpiService.ComputeActiveSalespersonCompositesAsync(period, cancellationToken);
        var teamAverage = IKpiScoringService.TeamAverageComposite(allComposites.Select(x => x.Result));
        var prevRevenue = await _kpiService.ComputeCompositeScoreAsync(salespersonId, prevPeriod, cancellationToken);

        var revenueMetric = composite.Metrics.FirstOrDefault(m => m.Metric == KpiMetric.REVENUE_VS_TARGET);
        var newCustomersMetric = composite.Metrics.FirstOrDefault(m => m.Metric == KpiMetric.NEW_CUSTOMERS);

        var revenueActual = GetDetail<double>(revenueMetric, "actual");
        var revenueTarget = GetDetail<double>(revenueMetric, "target");
        var achievementPct = TryGetDetail<double>(revenueMetric, "achievementPercent");
        var ncActual = (int)GetDetail<double>(newCustomersMetric, "actual");
        var ncTarget = (int)GetDetail<double>(newCustomersMetric, "target");

        var prevRevenueMetric = prevRevenue.Metrics.FirstOrDefault(m => m.Metric == KpiMetric.REVENUE_VS_TARGET);
        var prevRevenueActual = GetDetail<double>(prevRevenueMetric, "actual");

        // Extract supplementary KPIs from full KPI response
        int activeCount = 0, churnedCount = 0;
        double avgProductTypes = 0;
        var topHospitals = new List<TopHospital>();

        if (salespersonKpi != null)
        {
            activeCount = salespersonKpi.Supplementary.ActiveCustomers.Count;
            churnedCount = salespersonKpi.Supplementary.ChurnedCustomers.Count;
            avgProductTypes = salespersonKpi.Supplementary.ProductPenetration.AvgDistinctProductTypesPerCustomer;
            topHospitals = salespersonKpi.Supplementary.RevenueShareByHospital
                .Take(TopHospitalsLimit)
                .Select(h => new TopHospital(h.HospitalName, h.Revenue, h.SharePercent))
                .ToList();
        }

        return new KpiSummaryPayload(
            Salesperson: new SalespersonInfo(salesperson.DisplayName),
            Period: period,
            Composite: new CompositeInfo(composite.Composite, composite.ComputedFromLabel, composite.Message),
            Metrics: composite.Metrics.Select(m => new MetricInfo(m.Metric.ToString(), m.Computable, m.Score, m.Reason)).ToList(),
            VsTeamAverage: new VsTeamAverage(composite.Composite, teamAverage),
            VsPreviousPeriod: new VsPreviousPeriod(composite.Composite, previousComposite.Composite, revenueActual, prevRevenueActual),
            Revenue: new RevenueInfo(revenueActual, revenueTarget, achievementPct),
            NewCustomers: new NewCustomerInfo(ncActual, ncTarget),
            Supplementary: new SupplementaryInfo(activeCount, churnedCount, avgProductTypes, topHospitals));
    }

    private static T GetDetail<T>(MetricResultDto? metric, string key) where T : struct
    {
        if (metric == null || !metric.Detail.TryGetValue(key, out var v) || v == null) return default;
        if (v is T typed) return typed;
        if (v is JsonElement el)
        {
            try { return (T)(object)el.GetDouble(); }
            catch { return default; }
        }
        try { return (T)Convert.ChangeType(v, typeof(T)); }
        catch { return default; }
    }

    private static T? TryGetDetail<T>(MetricResultDto? metric, string key) where T : struct
    {
        if (metric == null || !metric.Detail.TryGetValue(key, out var v) || v == null) return null;
        if (v is T typed) return typed;
        if (v is JsonElement el && el.ValueKind == JsonValueKind.Number)
        {
            try { return (T)(object)el.GetDouble(); }
            catch { return null; }
        }
        try { return (T)Convert.ChangeType(v, typeof(T)); }
        catch { return null; }
    }

    // -----------------------------------------------------------------------
    //  PII Anonymizer (port of anonymizePayload)
    // -----------------------------------------------------------------------

    internal static KpiSummaryPayload AnonymizePayload(KpiSummaryPayload payload)
    {
        var hospitalLabelByName = new Dictionary<string, string>();
        int nextIndex = 1;

        string AnonymizeHospital(string name)
        {
            if (!hospitalLabelByName.TryGetValue(name, out var label))
            {
                label = $"โรงพยาบาล {nextIndex++}";
                hospitalLabelByName[name] = label;
            }
            return label;
        }

        return payload with
        {
            Salesperson = new SalespersonInfo(SalespersonAnonymizedLabel),
            Supplementary = payload.Supplementary with
            {
                TopHospitalsByRevenue = payload.Supplementary.TopHospitalsByRevenue
                    .Select(h => h with { HospitalName = AnonymizeHospital(h.HospitalName) })
                    .ToList(),
            },
        };
    }

    // -----------------------------------------------------------------------
    //  Rule-based summary (port of buildRuleBasedSummary from TS)
    // -----------------------------------------------------------------------

    internal static string BuildRuleBasedSummary(KpiSummaryPayload payload)
    {
        var parts = new List<string>();

        if (payload.Revenue.AchievementPercent.HasValue)
            parts.Add($"งวดนี้ทำยอดขายได้ {FormatPercent(payload.Revenue.AchievementPercent)} ของเป้า");
        else
            parts.Add("งวดนี้ยังไม่ได้ตั้งเป้ายอดขาย จึงยังสรุปเทียบเป้าไม่ได้");

        if (payload.Composite.Score.HasValue && payload.VsTeamAverage.TeamAverageComposite.HasValue)
        {
            var comparison = payload.Composite.Score.Value >= payload.VsTeamAverage.TeamAverageComposite.Value ? "สูงกว่า" : "ต่ำกว่า";
            parts.Add($"คะแนนรวมอยู่ที่ {payload.Composite.Score.Value:F1} {comparison}ค่าเฉลี่ยทีมที่ {payload.VsTeamAverage.TeamAverageComposite.Value:F1}");
        }

        var computable = payload.Metrics.Where(m => m.Computable && m.Score.HasValue).ToList();
        if (computable.Count > 0)
        {
            var best = computable.MaxBy(m => m.Score!.Value)!;
            var worst = computable.MinBy(m => m.Score!.Value)!;
            parts.Add($"จุดแข็ง: {MetricLabelTh.GetValueOrDefault(best.Metric, best.Metric)} ทำได้ {best.Score!.Value:F0} คะแนน");
            if (worst.Metric != best.Metric)
                parts.Add($"จุดที่ควรพัฒนา: {MetricLabelTh.GetValueOrDefault(worst.Metric, worst.Metric)} ทำได้เพียง {worst.Score!.Value:F0} คะแนน");
        }

        if (payload.NewCustomers.Target > 0)
            parts.Add($"ลูกค้าใหม่ {payload.NewCustomers.Actual} ราย จากเป้า {payload.NewCustomers.Target} ราย");

        if (payload.VsPreviousPeriod.PreviousCompositeScore.HasValue && payload.Composite.Score.HasValue)
        {
            var trend = payload.Composite.Score.Value - payload.VsPreviousPeriod.PreviousCompositeScore.Value;
            if (Math.Abs(trend) >= TrendThreshold)
                parts.Add(trend > 0 ? "แนวโน้มดีขึ้นจากงวดก่อน" : "แนวโน้มลดลงจากงวดก่อน");
        }

        return parts.Count > 0
            ? string.Join(" · ", parts)
            : "ยังไม่มีข้อมูลเพียงพอสำหรับสรุปจุดแข็ง-จุดที่ควรพัฒนาในงวดนี้";
    }

    // -----------------------------------------------------------------------
    //  Gemini prompt builder
    // -----------------------------------------------------------------------

    private static string BuildGeminiPrompt(KpiSummaryPayload payload)
    {
        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true,
        };
        return string.Join("\n", [
            "คุณเป็นโค้ชฝ่ายขายให้กับทีมขายเครื่องมือแพทย์ B2B",
            "จากข้อมูลสรุป KPI ที่คำนวณไว้แล้วด้านล่างนี้ (เป็น JSON) ให้เรียบเรียงเป็นคำแนะนำเชิงโค้ชภาษาไทย 2-4 ประโยค",
            "ระบุจุดแข็งอย่างน้อย 1 ข้อ และจุดที่ควรพัฒนาอย่างน้อย 1 ข้อ พร้อมอ้างอิงตัวเลขจากข้อมูลที่ให้มา",
            "ห้ามเดาหรือเพิ่มตัวเลขที่ไม่มีอยู่ในข้อมูล ห้ามใส่คำอธิบายอื่นนอกเหนือจากคำแนะนำ ตอบเป็นข้อความล้วน ไม่ต้องใส่ markdown",
            "",
            JsonSerializer.Serialize(payload, jsonOptions),
        ]);
    }

    private static string FormatPercent(double? value)
        => value == null ? "N/A" : $"{Math.Round(value.Value)}%";

    private static CoachingInsightDto MapInsight(CoachingInsight ci) => new()
    {
        Id = ci.Id,
        SalespersonId = ci.SalespersonId,
        PeriodType = ci.PeriodType.ToString(),
        Year = ci.Year,
        PeriodNumber = ci.PeriodNumber,
        KpiSnapshot = ci.KpiSnapshot,
        ContentTh = ci.ContentTh,
        Status = ci.Status.ToString(),
        Provider = ci.Provider,
        Model = ci.Model,
        ErrorMessage = ci.ErrorMessage,
        IsStale = ci.IsStale,
        GeneratedById = ci.GeneratedById,
        GeneratedAt = ci.GeneratedAt,
    };

    private static string NewId() => Guid.NewGuid().ToString("N")[..20];

    // -----------------------------------------------------------------------
    //  Payload records (mirroring TS KpiSummaryPayload interface)
    // -----------------------------------------------------------------------

    internal record KpiSummaryPayload(
        SalespersonInfo Salesperson,
        AppPeriodKey Period,
        CompositeInfo Composite,
        List<MetricInfo> Metrics,
        VsTeamAverage VsTeamAverage,
        VsPreviousPeriod VsPreviousPeriod,
        RevenueInfo Revenue,
        NewCustomerInfo NewCustomers,
        SupplementaryInfo Supplementary);

    internal record SalespersonInfo(string Name);
    internal record CompositeInfo(double? Score, string? ComputedFromLabel, string? Message);
    internal record MetricInfo(string Metric, bool Computable, double? Score, string? Reason);
    internal record VsTeamAverage(double? CompositeScore, double? TeamAverageComposite);
    internal record VsPreviousPeriod(double? CompositeScore, double? PreviousCompositeScore, double RevenueActual, double PreviousRevenueActual);
    internal record RevenueInfo(double Actual, double Target, double? AchievementPercent);
    internal record NewCustomerInfo(int Actual, int Target);
    internal record SupplementaryInfo(int ActiveCustomersCount, int ChurnedCustomersCount, double AvgDistinctProductTypesPerCustomer, List<TopHospital> TopHospitalsByRevenue);
    internal record TopHospital(string HospitalName, double Revenue, double SharePercent);
}
