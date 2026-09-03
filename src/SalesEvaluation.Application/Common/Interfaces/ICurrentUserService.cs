namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Domain.Enums;

public class CurrentUser
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool MustChangePassword { get; set; }
    public bool IsActive { get; set; }
}

public interface ICurrentUserService
{
    CurrentUser? User { get; }
}
