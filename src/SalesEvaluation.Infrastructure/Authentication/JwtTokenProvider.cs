namespace SalesEvaluation.Infrastructure.Authentication;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Enums;

public class JwtTokenProvider : IJwtTokenProvider
{
    private readonly SymmetricSecurityKey _key;
    private readonly string _issuer;
    private readonly string _audience;

    public JwtTokenProvider(IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(secret)) secret = configuration["JWT_SECRET"];
        if (string.IsNullOrWhiteSpace(secret)) secret = Environment.GetEnvironmentVariable("JWT_SECRET");

        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException(
                "JWT secret is not configured. Set Jwt:Secret in appsettings or the JWT_SECRET environment variable.");
        }

        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        _issuer = configuration["Jwt:Issuer"] ?? "SalesEvaluationApi";
        _audience = configuration["Jwt:Audience"] ?? "SalesEvaluationFrontend";
    }

    public string GenerateToken(string userId, UserRole role)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim("sub", userId),
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim("role", role.ToString()),
                new Claim(ClaimTypes.Role, role.ToString())
            }),
            Issuer = _issuer,
            Audience = _audience,
            Expires = DateTime.UtcNow.AddDays(1),
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public (string UserId, UserRole Role)? ValidateToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = _key,
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ClockSkew = TimeSpan.Zero
            }, out _);

            var userId = principal.FindFirst("sub")?.Value ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var roleStr = principal.FindFirst("role")?.Value ?? principal.FindFirst(ClaimTypes.Role)?.Value;

            if (!string.IsNullOrEmpty(userId) && Enum.TryParse<UserRole>(roleStr, out var role))
            {
                return (userId, role);
            }

            return null;
        }
        catch
        {
            return null;
        }
    }
}
