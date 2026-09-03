namespace SalesEvaluation.Contracts.Salespeople;

public class LinkedUserSummaryDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class SalespersonDto
{
    public int Id { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int? UserId { get; set; }
    public LinkedUserSummaryDto? User { get; set; }
    public bool ExcludedFromTerritoryTotals { get; set; }
    public string? EmploymentEndedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SalespeopleResponse
{
    public List<SalespersonDto> Salespeople { get; set; } = new();
}

public class SalespersonResponse
{
    public SalespersonDto Salesperson { get; set; } = null!;
}

public class UpdateSalespersonRequest
{
    public int? UserId { get; set; }
    public bool HasUserId { get; set; }
    public string? DisplayName { get; set; }
    public bool HasDisplayName { get; set; }
    public bool? IsActive { get; set; }
    public bool HasIsActive { get; set; }
    public bool? ExcludedFromTerritoryTotals { get; set; }
    public bool HasExcludedFromTerritoryTotals { get; set; }
    public string? EmploymentEndedAt { get; set; }
    public bool HasEmploymentEndedAt { get; set; }
}
