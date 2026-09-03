namespace SalesEvaluation.Application.Salespeople;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Salespeople;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class SalespersonService : ISalespersonService
{
    private readonly IAppDbContext _dbContext;

    public SalespersonService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SalespeopleResponse> ListSalespeopleAsync(CurrentUser currentUser, CancellationToken cancellationToken = default)
    {
        List<Salesperson> salespeople;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (currentUser.Role == UserRole.MANAGER)
        {
            salespeople = await _dbContext.Salespeople
                .AsNoTracking()
                .Include(s => s.User)
                .OrderBy(s => s.DisplayName)
                .ToListAsync(cancellationToken);
        }
        else
        {
            var linkedSalesperson = await _dbContext.Salespeople
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == currentUser.Id, cancellationToken);

            if (linkedSalesperson == null)
            {
                return new SalespeopleResponse { Salespeople = new List<SalespersonDto>() };
            }

            var selfId = linkedSalesperson.Id;

            // Find supervised territory IDs active today
            var supervisedTerritoryIds = await _dbContext.TerritoryAssignments
                .AsNoTracking()
                .Where(ta => ta.SalespersonId == selfId
                             && ta.IsSupervisor
                             && ta.EffectiveFrom <= today
                             && (ta.EffectiveTo == null || ta.EffectiveTo >= today))
                .Select(ta => ta.TerritoryId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var visibleSalespersonIds = new HashSet<string> { selfId };

            if (supervisedTerritoryIds.Count > 0)
            {
                var subordinateIds = await _dbContext.TerritoryAssignments
                    .AsNoTracking()
                    .Where(ta => supervisedTerritoryIds.Contains(ta.TerritoryId)
                                 && ta.EffectiveFrom <= today
                                 && (ta.EffectiveTo == null || ta.EffectiveTo >= today))
                    .Select(ta => ta.SalespersonId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var id in subordinateIds)
                {
                    visibleSalespersonIds.Add(id);
                }
            }

            salespeople = await _dbContext.Salespeople
                .AsNoTracking()
                .Include(s => s.User)
                .Where(s => visibleSalespersonIds.Contains(s.Id))
                .OrderBy(s => s.DisplayName)
                .ToListAsync(cancellationToken);
        }

        return new SalespeopleResponse
        {
            Salespeople = salespeople.Select(MapToDto).ToList()
        };
    }

    public async Task<SalespersonResponse> UpdateSalespersonAsync(string id, UpdateSalespersonRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Salesperson ID is required");
        }

        if (!request.HasUserId && !request.HasDisplayName && !request.HasIsActive && !request.HasExcludedFromTerritoryTotals && !request.HasEmploymentEndedAt)
        {
            throw new ValidationException("Validation failed", "ต้องระบุอย่างน้อยหนึ่งฟิลด์");
        }

        var salesperson = await _dbContext.Salespeople
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (salesperson == null)
        {
            throw new NotFoundException("Salesperson not found");
        }

        if (request.HasUserId)
        {
            if (request.UserId != null)
            {
                var userExists = await _dbContext.Users
                    .AnyAsync(u => u.Id == request.UserId, cancellationToken);

                if (!userExists)
                {
                    throw new NotFoundException("User not found");
                }

                var isAlreadyLinked = await _dbContext.Salespeople
                    .AnyAsync(s => s.UserId == request.UserId && s.Id != id, cancellationToken);

                if (isAlreadyLinked)
                {
                    throw new ConflictException("This user is already linked to another salesperson");
                }
            }

            salesperson.UserId = request.UserId;
        }

        if (request.HasDisplayName && request.DisplayName != null)
        {
            var trimmed = request.DisplayName.Trim();
            if (trimmed.Length == 0)
            {
                throw new ValidationException("Validation failed", "DisplayName must not be empty");
            }
            salesperson.DisplayName = trimmed;
        }

        if (request.HasIsActive && request.IsActive.HasValue)
        {
            salesperson.IsActive = request.IsActive.Value;
        }

        if (request.HasExcludedFromTerritoryTotals && request.ExcludedFromTerritoryTotals.HasValue)
        {
            salesperson.ExcludedFromTerritoryTotals = request.ExcludedFromTerritoryTotals.Value;
        }

        if (request.HasEmploymentEndedAt)
        {
            if (string.IsNullOrWhiteSpace(request.EmploymentEndedAt))
            {
                salesperson.EmploymentEndedAt = null;
            }
            else
            {
                if (!DateOnly.TryParseExact(request.EmploymentEndedAt, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
                {
                    throw new ValidationException("Validation failed", "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
                }
                salesperson.EmploymentEndedAt = parsedDate;
            }
        }

        salesperson.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload user relation if userId changed
        if (salesperson.UserId != null && (salesperson.User == null || salesperson.User.Id != salesperson.UserId))
        {
            salesperson.User = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == salesperson.UserId, cancellationToken);
        }
        else if (salesperson.UserId == null)
        {
            salesperson.User = null;
        }

        return new SalespersonResponse
        {
            Salesperson = MapToDto(salesperson)
        };
    }

    private static SalespersonDto MapToDto(Salesperson salesperson)
    {
        return new SalespersonDto
        {
            Id = salesperson.Id,
            NameInFile = salesperson.NameInFile,
            DisplayName = salesperson.DisplayName,
            IsActive = salesperson.IsActive,
            UserId = salesperson.UserId,
            User = salesperson.User == null ? null : new LinkedUserSummaryDto
            {
                Id = salesperson.User.Id,
                Email = salesperson.User.Email,
                DisplayName = salesperson.User.DisplayName
            },
            ExcludedFromTerritoryTotals = salesperson.ExcludedFromTerritoryTotals,
            EmploymentEndedAt = salesperson.EmploymentEndedAt.HasValue ? salesperson.EmploymentEndedAt.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null,
            CreatedAt = salesperson.CreatedAt,
            UpdatedAt = salesperson.UpdatedAt
        };
    }
}
