namespace SalesEvaluation.Contracts.Users;

public class SalespersonSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string NameInFile { get; set; } = string.Empty;
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public SalespersonSummaryDto? Salesperson { get; set; }
    public bool IsSalespersonLinked { get; set; }
}

public class UsersResponse
{
    public List<UserDto> Users { get; set; } = new();
}

public class CreateUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? TemporaryPassword { get; set; }
}

public class CreateUserResponse
{
    public UserDto User { get; set; } = null!;
    public string TemporaryPassword { get; set; } = string.Empty;
}

public class UpdateUserRequest
{
    public string? DisplayName { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public string? SalespersonId { get; set; }
    public bool HasSalespersonId { get; set; }
}

public class UserResponse
{
    public UserDto User { get; set; } = null!;
}

public class ResetPasswordRequest
{
    public string? TemporaryPassword { get; set; }
}

public class ResetPasswordResponse
{
    public string Message { get; set; } = string.Empty;
    public string TemporaryPassword { get; set; } = string.Empty;
}
