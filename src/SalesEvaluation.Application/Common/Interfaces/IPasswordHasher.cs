namespace SalesEvaluation.Application.Common.Interfaces;

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
    string GenerateTemporaryPassword(int length = 12);
}
