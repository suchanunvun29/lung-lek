namespace SalesEvaluation.Application.Hospitals;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Hospitals;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Domain.MasterData;

public class HospitalService : IHospitalService
{
    private const decimal AmbiguityThreshold = 0.3m;
    private readonly IAppDbContext _dbContext;

    public HospitalService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HospitalsResponse> ListHospitalsAsync(CancellationToken cancellationToken = default)
    {
        var hospitals = await _dbContext.Hospitals
            .AsNoTracking()
            .Include(h => h.Territory)
            .Include(h => h.Aliases)
            .OrderBy(h => h.DisplayName)
            .ToListAsync(cancellationToken);

        return new HospitalsResponse
        {
            Hospitals = hospitals.Select(MapToDto).ToList()
        };
    }

    public async Task<HospitalResponse> UpdateHospitalAsync(string id, UpdateHospitalRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Hospital ID is required");
        }

        var hospital = await _dbContext.Hospitals
            .Include(h => h.Territory)
            .Include(h => h.Aliases)
            .FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        if (hospital == null)
        {
            throw new NotFoundException("Hospital not found");
        }

        if (request.HasIsPreExistingCustomer && request.IsPreExistingCustomer.HasValue)
        {
            hospital.IsPreExistingCustomer = request.IsPreExistingCustomer.Value;
        }

        if (request.HasDisplayName && request.DisplayName != null)
        {
            var trimmed = request.DisplayName.Trim();
            if (trimmed.Length == 0)
            {
                throw new ValidationException("Validation failed", "DisplayName must not be empty");
            }
            hospital.DisplayName = trimmed;
        }

        if (request.HasProvince)
        {
            hospital.Province = request.Province;
        }

        hospital.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new HospitalResponse
        {
            Hospital = MapToDto(hospital)
        };
    }

    public async Task<CreateHospitalAliasResponse> AddHospitalAliasAsync(string hospitalId, CreateHospitalAliasRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(hospitalId))
        {
            throw new ValidationException("Validation failed", "Hospital ID is required");
        }

        if (string.IsNullOrWhiteSpace(request.SampleRaw))
        {
            throw new ValidationException("Validation failed", "SampleRaw is required");
        }

        var hospital = await _dbContext.Hospitals
            .FirstOrDefaultAsync(h => h.Id == hospitalId, cancellationToken);

        if (hospital == null)
        {
            throw new NotFoundException("Hospital not found");
        }

        var sampleRaw = request.SampleRaw.Trim();
        var normalizedKey = !string.IsNullOrWhiteSpace(request.NormalizedKey)
            ? request.NormalizedKey.Trim().ToUpperInvariant()
            : NameNormalizer.LatinCore(sampleRaw);

        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            normalizedKey = sampleRaw.ToUpperInvariant();
        }

        var existingAlias = await _dbContext.HospitalAliases
            .FirstOrDefaultAsync(a => a.NormalizedKey == normalizedKey, cancellationToken);

        if (existingAlias != null)
        {
            throw new ConflictException($"Hospital alias with key '{normalizedKey}' already exists");
        }

        var alias = new HospitalAlias
        {
            Id = Guid.NewGuid().ToString(),
            NormalizedKey = normalizedKey,
            SampleRaw = sampleRaw,
            HospitalId = hospitalId,
            Source = NameDecisionSource.MANAGER,
            DecidedById = userId,
            DecidedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.HospitalAliases.Add(alias);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateHospitalAliasResponse
        {
            HospitalAlias = new HospitalAliasDto
            {
                Id = alias.Id,
                NormalizedKey = alias.NormalizedKey,
                SampleRaw = alias.SampleRaw,
                HospitalId = alias.HospitalId,
                Source = alias.Source.ToString(),
                DecidedById = alias.DecidedById,
                DecidedAt = alias.DecidedAt,
                CreatedAt = alias.CreatedAt
            }
        };
    }

    public async Task<HospitalResponse> PatchHospitalTerritoryAsync(string id, PatchHospitalTerritoryRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Hospital ID is required");
        }

        var hospital = await _dbContext.Hospitals
            .Include(h => h.Territory)
            .Include(h => h.Aliases)
            .FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        if (hospital == null)
        {
            throw new NotFoundException("Hospital not found");
        }

        if (request.TerritoryId != null)
        {
            var territoryExists = await _dbContext.Territories
                .AnyAsync(t => t.Id == request.TerritoryId, cancellationToken);

            if (!territoryExists)
            {
                throw new NotFoundException("Territory not found");
            }
        }

        var fromTerritoryId = hospital.TerritoryId;

        hospital.TerritoryId = request.TerritoryId;
        hospital.TerritorySource = TerritoryLinkSource.MANUAL;
        hospital.UpdatedAt = DateTime.UtcNow;

        var changeLog = new HospitalTerritoryChange
        {
            Id = Guid.NewGuid().ToString(),
            HospitalId = id,
            FromTerritoryId = fromTerritoryId,
            ToTerritoryId = request.TerritoryId,
            ChangedById = userId,
            Note = request.Note,
            ChangedAt = DateTime.UtcNow
        };

        _dbContext.HospitalTerritoryChanges.Add(changeLog);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (hospital.TerritoryId != null)
        {
            hospital.Territory = await _dbContext.Territories.AsNoTracking().FirstOrDefaultAsync(t => t.Id == hospital.TerritoryId, cancellationToken);
        }
        else
        {
            hospital.Territory = null;
        }

        return new HospitalResponse
        {
            Hospital = MapToDto(hospital)
        };
    }

    public async Task<BulkMoveHospitalsResponse> BulkMoveHospitalsByProvinceAsync(BulkMoveHospitalsByProvinceRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Province))
        {
            throw new ValidationException("Validation failed", "Province is required");
        }

        if (request.TerritoryId != null)
        {
            var territoryExists = await _dbContext.Territories
                .AnyAsync(t => t.Id == request.TerritoryId, cancellationToken);

            if (!territoryExists)
            {
                throw new NotFoundException("Territory not found");
            }
        }

        var hospitals = await _dbContext.Hospitals
            .Where(h => h.Province == request.Province)
            .ToListAsync(cancellationToken);

        foreach (var hospital in hospitals)
        {
            var fromTerritoryId = hospital.TerritoryId;
            hospital.TerritoryId = request.TerritoryId;
            hospital.TerritorySource = TerritoryLinkSource.MANUAL;
            hospital.UpdatedAt = DateTime.UtcNow;

            var changeLog = new HospitalTerritoryChange
            {
                Id = Guid.NewGuid().ToString(),
                HospitalId = hospital.Id,
                FromTerritoryId = fromTerritoryId,
                ToTerritoryId = request.TerritoryId,
                ChangedById = userId,
                Note = request.Note,
                ChangedAt = DateTime.UtcNow
            };

            _dbContext.HospitalTerritoryChanges.Add(changeLog);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new BulkMoveHospitalsResponse
        {
            UpdatedCount = hospitals.Count
        };
    }

    public async Task<UnassignedTerritoryHospitalsResponse> ListUnassignedTerritoryHospitalsAsync(CancellationToken cancellationToken = default)
    {
        var hospitals = await _dbContext.Hospitals
            .AsNoTracking()
            .Where(h => h.TerritoryId == null)
            .OrderBy(h => h.DisplayName)
            .ToListAsync(cancellationToken);

        var hospitalIds = hospitals.Select(h => h.Id).ToList();

        var credits = await _dbContext.SalesLineCredits
            .AsNoTracking()
            .Where(c => !c.Salesperson.ExcludedFromTerritoryTotals && hospitalIds.Contains(c.SalesLine.HospitalId))
            .Select(c => new
            {
                SalespersonId = c.SalespersonId,
                SharePercent = c.SharePercent,
                HospitalId = c.SalesLine.HospitalId,
                Total = c.SalesLine.Total
            })
            .ToListAsync(cancellationToken);

        // Group credits by hospitalId -> Map<salespersonId, sum(revenue)>
        var revenueByHospitalPerson = new Dictionary<string, Dictionary<string, decimal>>();
        foreach (var credit in credits)
        {
            if (!revenueByHospitalPerson.TryGetValue(credit.HospitalId, out var byPerson))
            {
                byPerson = new Dictionary<string, decimal>();
                revenueByHospitalPerson[credit.HospitalId] = byPerson;
            }

            var creditRevenue = credit.Total * (credit.SharePercent / 100m);
            byPerson[credit.SalespersonId] = byPerson.GetValueOrDefault(credit.SalespersonId) + creditRevenue;
        }

        var rows = new List<UnassignedTerritoryHospitalDto>();
        decimal totalUnassignedBucket = 0m;

        foreach (var hospital in hospitals)
        {
            var byPerson = revenueByHospitalPerson.GetValueOrDefault(hospital.Id) ?? new Dictionary<string, decimal>();
            var hospitalUnassignedBucket = byPerson.Values.Sum();
            totalUnassignedBucket += hospitalUnassignedBucket;

            var ranked = byPerson
                .Select(kv => new { SalespersonId = kv.Key, Revenue = kv.Value })
                .OrderByDescending(x => x.Revenue)
                .ToList();

            var ambiguous = ranked.Count > 1 && ranked[1].Revenue >= (ranked[0].Revenue * AmbiguityThreshold);

            rows.Add(new UnassignedTerritoryHospitalDto
            {
                Id = hospital.Id,
                NameInFile = hospital.NameInFile,
                DisplayName = hospital.DisplayName,
                Province = hospital.Province,
                IsPreExistingCustomer = hospital.IsPreExistingCustomer,
                TerritoryId = hospital.TerritoryId,
                TerritorySource = hospital.TerritorySource.ToString(),
                ProvinceMappingId = hospital.ProvinceMappingId,
                UnassignedBucket = hospitalUnassignedBucket,
                Ambiguous = ambiguous,
                CreatedAt = hospital.CreatedAt,
                UpdatedAt = hospital.UpdatedAt
            });
        }

        return new UnassignedTerritoryHospitalsResponse
        {
            Hospitals = rows,
            UnassignedBucket = totalUnassignedBucket,
            HospitalCount = rows.Count
        };
    }

    private static HospitalDto MapToDto(Hospital hospital)
    {
        return new HospitalDto
        {
            Id = hospital.Id,
            NameInFile = hospital.NameInFile,
            DisplayName = hospital.DisplayName,
            Province = hospital.Province,
            IsPreExistingCustomer = hospital.IsPreExistingCustomer,
            TerritoryId = hospital.TerritoryId,
            TerritorySource = hospital.TerritorySource.ToString(),
            ProvinceMappingId = hospital.ProvinceMappingId,
            Territory = hospital.Territory == null ? null : new HospitalTerritorySummaryDto
            {
                Id = hospital.Territory.Id,
                Name = hospital.Territory.Name
            },
            Aliases = hospital.Aliases?.Select(a => new HospitalAliasDto
            {
                Id = a.Id,
                NormalizedKey = a.NormalizedKey,
                SampleRaw = a.SampleRaw,
                HospitalId = a.HospitalId,
                Source = a.Source.ToString(),
                DecidedById = a.DecidedById,
                DecidedAt = a.DecidedAt,
                CreatedAt = a.CreatedAt
            }).ToList() ?? new List<HospitalAliasDto>(),
            CreatedAt = hospital.CreatedAt,
            UpdatedAt = hospital.UpdatedAt
        };
    }
}
