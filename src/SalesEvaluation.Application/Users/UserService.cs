namespace SalesEvaluation.Application.Users;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Users;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class UserService : IUserService
{
    private readonly IAppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;

    public UserService(IAppDbContext dbContext, IPasswordHasher passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<UsersResponse> ListUsersAsync(string? role = null, bool? unlinkedOnly = null, string? q = null, CancellationToken cancellationToken = default)
    {
        var users = await ApplyListFilters(role, unlinkedOnly, q)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(cancellationToken);

        return new UsersResponse
        {
            Users = users.Select(MapToDto).ToList()
        };
    }

    public async Task<UsersPageResponse> ListUsersPageAsync(int page, int pageSize, string? role = null, bool? unlinkedOnly = null, string? q = null, CancellationToken cancellationToken = default)
    {
        var query = ApplyListFilters(role, unlinkedOnly, q);

        var total = await query.CountAsync(cancellationToken);
        var users = await query
            .OrderBy(u => u.CreatedAt).ThenBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new UsersPageResponse
        {
            Items = users.Select(MapToDto).ToList(),
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    private IQueryable<User> ApplyListFilters(string? role, bool? unlinkedOnly, string? q)
    {
        var query = _dbContext.Users
            .AsNoTracking()
            .Include(u => u.Salesperson)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var parsedRole))
        {
            query = query.Where(u => u.Role == parsedRole);
        }

        if (unlinkedOnly == true)
        {
            query = query.Where(u => u.Role == UserRole.SALESPERSON && u.Salesperson == null);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLower();
            query = query.Where(u =>
                u.DisplayName.ToLower().Contains(needle) ||
                u.Email.ToLower().Contains(needle) ||
                (u.Salesperson != null && u.Salesperson.DisplayName.ToLower().Contains(needle)));
        }

        return query;
    }

    public async Task<CreateUserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.DisplayName))
        {
            throw new ValidationException("Validation failed", "Email and DisplayName are required");
        }

        var normalizedEmail = request.Email.Trim();
        var existing = await _dbContext.Users
            .AnyAsync(u => u.Email.ToLower() == normalizedEmail.ToLower(), cancellationToken);

        if (existing)
        {
            throw new ConflictException("A user with this email already exists");
        }

        var parsedRole = UserRole.SALESPERSON;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (!Enum.TryParse<UserRole>(request.Role, true, out parsedRole))
            {
                throw new ValidationException("Validation failed", $"Invalid role: {request.Role}");
            }
        }

        var plainPassword = !string.IsNullOrWhiteSpace(request.TemporaryPassword)
            ? request.TemporaryPassword.Trim()
            : _passwordHasher.GenerateTemporaryPassword();

        if (plainPassword.Length < Auth.PasswordPolicy.MinLength)
        {
            throw new ValidationException("Validation failed", Auth.PasswordPolicy.TemporaryPasswordTooShortMessage);
        }

        var passwordHash = _passwordHasher.HashPassword(plainPassword);

        var user = new User
        {
            Email = normalizedEmail,
            DisplayName = request.DisplayName.Trim(),
            Role = parsedRole,
            PasswordHash = passwordHash,
            MustChangePassword = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateUserResponse
        {
            User = MapToDto(user),
            TemporaryPassword = plainPassword
        };
    }

    public async Task<UserResponse> UpdateUserAsync(int id, UpdateUserRequest request, int currentUserId, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .Include(u => u.Salesperson)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        if (request.IsActive == false && id == currentUserId)
        {
            throw new ValidationException("Validation failed", "Cannot deactivate your own account");
        }

        if (request.HasSalespersonId)
        {
            if (!request.SalespersonId.HasValue)
            {
                // Unlink any salesperson currently linked to this user
                var currentSalespersons = await _dbContext.Salespeople
                    .Where(s => s.UserId == id)
                    .ToListAsync(cancellationToken);

                foreach (var sp in currentSalespersons)
                {
                    sp.UserId = null;
                }
            }
            else
            {
                var targetSalesperson = await _dbContext.Salespeople
                    .FirstOrDefaultAsync(s => s.Id == request.SalespersonId.Value, cancellationToken);

                if (targetSalesperson == null)
                {
                    throw new NotFoundException("Salesperson not found");
                }

                if (targetSalesperson.UserId.HasValue && targetSalesperson.UserId.Value != id)
                {
                    throw new ConflictException("This salesperson is already linked to another user", "ASSIGNMENT_CONFLICT");
                }

                var otherSalespersons = await _dbContext.Salespeople
                    .Where(s => s.UserId == id && s.Id != request.SalespersonId.Value)
                    .ToListAsync(cancellationToken);

                foreach (var sp in otherSalespersons)
                {
                    sp.UserId = null;
                }

                targetSalesperson.UserId = id;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            user.DisplayName = request.DisplayName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (Enum.TryParse<UserRole>(request.Role, true, out var updatedRole))
            {
                user.Role = updatedRole;
            }
            else
            {
                throw new ValidationException("Validation failed", $"Invalid role: {request.Role}");
            }
        }

        if (request.IsActive.HasValue)
        {
            user.IsActive = request.IsActive.Value;
        }

        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload user with current salesperson relation
        var reloadedUser = await _dbContext.Users
            .AsNoTracking()
            .Include(u => u.Salesperson)
            .FirstAsync(u => u.Id == id, cancellationToken);

        return new UserResponse
        {
            User = MapToDto(reloadedUser)
        };
    }

    public async Task<ResetPasswordResponse> ResetPasswordAsync(int id, ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        var plainPassword = !string.IsNullOrWhiteSpace(request.TemporaryPassword)
            ? request.TemporaryPassword.Trim()
            : _passwordHasher.GenerateTemporaryPassword();

        if (plainPassword.Length < Auth.PasswordPolicy.MinLength)
        {
            throw new ValidationException("Validation failed", Auth.PasswordPolicy.TemporaryPasswordTooShortMessage);
        }

        user.PasswordHash = _passwordHasher.HashPassword(plainPassword);
        user.MustChangePassword = true;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ResetPasswordResponse
        {
            Message = "Password reset",
            TemporaryPassword = plainPassword
        };
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            MustChangePassword = user.MustChangePassword,
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            Salesperson = user.Salesperson == null ? null : new SalespersonSummaryDto
            {
                Id = user.Salesperson.Id,
                DisplayName = user.Salesperson.DisplayName,
                NameInFile = user.Salesperson.NameInFile
            },
            IsSalespersonLinked = user.Role != UserRole.SALESPERSON || user.Salesperson != null
        };
    }
}
