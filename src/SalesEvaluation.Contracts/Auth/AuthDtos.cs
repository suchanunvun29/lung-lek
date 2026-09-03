namespace SalesEvaluation.Contracts.Auth;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthUserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public AuthUserDto User { get; set; } = null!;
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordResponse
{
    public string Message { get; set; } = string.Empty;
}

public class GetMeResponse
{
    public AuthUserDto User { get; set; } = null!;
}
