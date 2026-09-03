namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Domain.Enums;

public interface IJwtTokenProvider
{
    string GenerateToken(string userId, UserRole role);
    (string UserId, UserRole Role)? ValidateToken(string token);
}
