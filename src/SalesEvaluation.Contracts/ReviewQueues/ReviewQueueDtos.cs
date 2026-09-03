namespace SalesEvaluation.Contracts.ReviewQueues;

public class DeciderSummaryDto
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public class SalespersonSummaryDto
{
    public int Id { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool? IsActive { get; set; }
}

public class HospitalNameReviewDto
{
    public int Id { get; set; }
    public string NormalizedKeyA { get; set; } = string.Empty;
    public string NormalizedKeyB { get; set; } = string.Empty;
    public string SampleRawA { get; set; } = string.Empty;
    public string SampleRawB { get; set; } = string.Empty;
    public decimal? Similarity { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? MergedIntoId { get; set; }
    public int? DecidedById { get; set; }
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
    public int? MergedIntoId { get; set; }
    public string? Note { get; set; }
}

public class SalesmanNameReviewDto
{
    public int Id { get; set; }
    public string PersonKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CreatedSalespersonId { get; set; }
    public SalespersonSummaryDto? CreatedSalesperson { get; set; }
    public int? MergedIntoId { get; set; }
    public SalespersonSummaryDto? MergedInto { get; set; }
    public int? DecidedById { get; set; }
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
    public int? MergedIntoId { get; set; }
    public string? Note { get; set; }
}

public class SalesmanNameRuleMemberDto
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public int SalespersonId { get; set; }
    public decimal SharePercent { get; set; }
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
}

public class SalesmanNameRuleDto
{
    public int Id { get; set; }
    public string NormalizedRaw { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public int? DecidedById { get; set; }
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
    public int SalespersonId { get; set; }
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
