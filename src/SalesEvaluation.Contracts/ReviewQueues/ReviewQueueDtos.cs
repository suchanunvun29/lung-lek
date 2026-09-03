namespace SalesEvaluation.Contracts.ReviewQueues;

public class DeciderSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class SalespersonSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool? IsActive { get; set; }
}

public class HospitalNameReviewDto
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedKeyA { get; set; } = string.Empty;
    public string NormalizedKeyB { get; set; } = string.Empty;
    public string SampleRawA { get; set; } = string.Empty;
    public string SampleRawB { get; set; } = string.Empty;
    public decimal? Similarity { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? MergedIntoId { get; set; }
    public string? DecidedById { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class HospitalNameReviewsResponse
{
    public List<HospitalNameReviewDto> HospitalNameReviews { get; set; } = new();
}

public class HospitalNameReviewResponse
{
    public HospitalNameReviewDto HospitalNameReview { get; set; } = null!;
}

public class DecideHospitalNameReviewRequest
{
    public string Decision { get; set; } = string.Empty; // "MERGED" or "KEPT_SEPARATE"
    public string? MergedIntoId { get; set; }
    public string? Note { get; set; }
}

public class SalesmanNameReviewDto
{
    public string Id { get; set; } = string.Empty;
    public string PersonKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? CreatedSalespersonId { get; set; }
    public SalespersonSummaryDto? CreatedSalesperson { get; set; }
    public string? MergedIntoId { get; set; }
    public SalespersonSummaryDto? MergedInto { get; set; }
    public string? DecidedById { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SalesmanNameReviewsResponse
{
    public List<SalesmanNameReviewDto> SalesmanNameReviews { get; set; } = new();
}

public class SalesmanNameReviewResponse
{
    public SalesmanNameReviewDto SalesmanNameReview { get; set; } = null!;
}

public class DecideSalesmanNameReviewRequest
{
    public string Decision { get; set; } = string.Empty; // "MERGED" or "KEPT_SEPARATE"
    public string? MergedIntoId { get; set; }
    public string? Note { get; set; }
}

public class SalesmanNameRuleMemberDto
{
    public string Id { get; set; } = string.Empty;
    public string RuleId { get; set; } = string.Empty;
    public string SalespersonId { get; set; } = string.Empty;
    public decimal SharePercent { get; set; }
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
}

public class SalesmanNameRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedRaw { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string? DecidedById { get; set; }
    public DeciderSummaryDto? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<SalesmanNameRuleMemberDto> Members { get; set; } = new();
}

public class SalesmanNameRulesResponse
{
    public List<SalesmanNameRuleDto> SalesmanNameRules { get; set; } = new();
}

public class SalesmanNameRuleResponse
{
    public SalesmanNameRuleDto SalesmanNameRule { get; set; } = null!;
}

public class SalesmanNameRuleMemberInputDto
{
    public string SalespersonId { get; set; } = string.Empty;
    public decimal SharePercent { get; set; }
}

public class UpdateSalesmanNameRuleRequest
{
    public List<SalesmanNameRuleMemberInputDto> Members { get; set; } = new();
}

public class CreateSalesmanNameRuleRequest
{
    public string SampleRaw { get; set; } = string.Empty;
    public List<SalesmanNameRuleMemberInputDto> Members { get; set; } = new();
}
