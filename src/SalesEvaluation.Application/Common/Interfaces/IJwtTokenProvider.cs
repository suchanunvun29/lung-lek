namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Domain.Enums;

public interface IJwtTokenProvider
{
    string GenerateToken(int userId, UserRole role);
    (int UserId, UserRole Role)? ValidateToken(string token);
}
