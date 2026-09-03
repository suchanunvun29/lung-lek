namespace SalesEvaluation.Infrastructure.Authentication;

using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;
using SalesEvaluation.Application.Common.Interfaces;

public class PasswordHasher : IPasswordHasher
{
    private const int SaltRounds = 10;
    private const string AllowedChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";

    public string HashPassword(string password)
    {
        return BCrypt.HashPassword(password, SaltRounds);
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        try
        {
            return BCrypt.Verify(password, passwordHash);
        }
        catch
        {
            return false;
        }
    }

    public string GenerateTemporaryPassword(int length = 12)
    {
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(length);
        foreach (var b in bytes)
        {
            sb.Append(AllowedChars[b % AllowedChars.Length]);
        }
        return sb.ToString();
    }
}
