namespace SalesEvaluation.Application.Auth;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Auth;

public class AuthService : IAuthService
{
    private const string InvalidCredentialsMessage = "Invalid email or password";
    private readonly IAppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenProvider _jwtTokenProvider;

    public AuthService(
        IAppDbContext dbContext,
        IPasswordHasher passwordHasher,
        IJwtTokenProvider jwtTokenProvider)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenProvider = jwtTokenProvider;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null || !user.IsActive)
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        var passwordMatches = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
        if (!passwordMatches)
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        var token = _jwtTokenProvider.GenerateToken(user.Id, user.Role);

        return new LoginResponse
        {
            Token = token,
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role.ToString(),
                MustChangePassword = user.MustChangePassword
            }
        };
    }

    public async Task<ChangePasswordResponse> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            throw new ValidationException("Validation failed", "Current password and new password are required");
        }

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        var passwordMatches = _passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash);
        if (!passwordMatches)
        {
            throw new UnauthorizedException("Current password is incorrect");
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ChangePasswordResponse
        {
            Message = "Password changed successfully"
        };
    }

    public async Task<GetMeResponse> GetMeAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        return new GetMeResponse
        {
            User = new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role.ToString(),
                MustChangePassword = user.MustChangePassword
            }
        };
    }
}
