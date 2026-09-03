namespace SalesEvaluation.Application.HospitalRegistry;

using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.HospitalRegistry;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class HospitalRegistryService : IHospitalRegistryService
{
    private readonly IAppDbContext _dbContext;

    public HospitalRegistryService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // ---- Provinces ----

    public async Task<ProvincesResponse> ListProvincesAsync(CancellationToken cancellationToken = default)
    {
        var provinces = await _dbContext.ProvinceMappings
            .AsNoTracking()
            .Include(p => p.Region)
            .OrderBy(p => p.CanonicalName)
            .ToListAsync(cancellationToken);

        var regions = await _dbContext.Regions
            .AsNoTracking()
            .OrderBy(r => r.SortOrder)
            .ToListAsync(cancellationToken);

        return new ProvincesResponse
        {
            Provinces = provinces.Select(MapProvince).ToList(),
            Regions = regions.Select(MapRegion).ToList()
        };
    }

    public async Task<ProvinceResponse> UpdateProvinceAsync(int id, UpdateProvinceRequest request, CancellationToken cancellationToken = default)
    {
        var province = await _dbContext.ProvinceMappings
            .Include(p => p.Region)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (province == null)
        {
            throw new NotFoundException("Province not found");
        }

        if (!request.HasAnyField)
        {
            throw new ValidationException("Validation failed", "Provide canonicalName or regionId");
        }

        if (request.HasRegionId && request.RegionId.HasValue &&
            !await _dbContext.Regions.AnyAsync(r => r.Id == request.RegionId.Value, cancellationToken))
        {
            throw new NotFoundException("Region not found");
        }

        if (request.HasCanonicalName)
        {
            if (string.IsNullOrWhiteSpace(request.CanonicalName))
            {
                throw new ValidationException("Validation failed", "canonicalName must not be empty");
            }
            province.CanonicalName = request.CanonicalName.Trim();
        }

        if (request.HasRegionId && request.RegionId.HasValue)
        {
            province.RegionId = request.RegionId.Value;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload with the region include, mirroring the Prisma `include: { region: true }` update response.
        var reloaded = await _dbContext.ProvinceMappings
            .AsNoTracking()
            .Include(p => p.Region)
            .FirstAsync(p => p.Id == province.Id, cancellationToken);

        return new ProvinceResponse { Province = MapProvince(reloaded) };
    }

    private static ProvinceMappingDto MapProvince(ProvinceMapping province)
    {
        return new ProvinceMappingDto
        {
            Id = province.Id,
            CanonicalName = province.CanonicalName,
            RegionId = province.RegionId,
            Region = province.Region == null ? null : MapRegion(province.Region),
            CreatedAt = province.CreatedAt
        };
    }

    private static RegionDto MapRegion(Region region)
    {
        return new RegionDto
        {
            Id = region.Id,
            Name = region.Name,
            SortOrder = region.SortOrder,
            CreatedAt = region.CreatedAt
        };
    }

    // ---- Hospital registries ----

    public async Task<HospitalRegistriesResponse> ListHospitalRegistriesAsync(string? q, int? provinceMappingId, int? territoryId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.HospitalRegistries
            .AsNoTracking()
            .Include(r => r.ProvinceMapping)
            .ThenInclude(p => p!.Region)
            .Include(r => r.Territory)
            .Include(r => r.Metrics)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim().ToLowerInvariant();
            query = query.Where(r =>
                r.DisplayName.ToLower().Contains(needle) ||
                (r.SourceCode != null && r.SourceCode.ToLower().Contains(needle)));
        }

        if (provinceMappingId.HasValue)
        {
            query = query.Where(r => r.ProvinceMappingId == provinceMappingId.Value);
        }

        if (territoryId.HasValue)
        {
            query = query.Where(r => r.TerritoryId == territoryId.Value);
        }

        var total = await query.CountAsync(cancellationToken);

        var registries = await query
            .OrderBy(r => r.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new HospitalRegistriesResponse
        {
            HospitalRegistries = registries.Select(MapRegistry).ToList(),
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PotentialAdjustmentResponse> UpdatePotentialAdjustmentAsync(int id, decimal potentialAdjustment, CancellationToken cancellationToken = default)
    {
        var registry = await _dbContext.HospitalRegistries
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (registry == null)
        {
            throw new NotFoundException("Hospital registry not found");
        }

        // requirement 10.5 — per-hospital exemption/reduction; 0 removes it from potential entirely.
        registry.PotentialAdjustment = potentialAdjustment;
        registry.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PotentialAdjustmentResponse
        {
            HospitalRegistry = new PotentialAdjustmentDto
            {
                Id = registry.Id,
                DisplayName = registry.DisplayName,
                Tier = registry.Tier,
                PotentialAdjustment = ToDecimalString(registry.PotentialAdjustment),
                UpdatedAt = registry.UpdatedAt
            }
        };
    }

    private static HospitalRegistryDto MapRegistry(HospitalRegistry registry)
    {
        return new HospitalRegistryDto
        {
            Id = registry.Id,
            SourceCode = registry.SourceCode,
            NameInFile = registry.NameInFile,
            DisplayName = registry.DisplayName,
            ProvinceMappingId = registry.ProvinceMappingId,
            ProvinceMapping = registry.ProvinceMapping == null ? null : MapProvince(registry.ProvinceMapping),
            ProvinceRaw = registry.ProvinceRaw,
            RegionId = registry.RegionId,
            Region = registry.Region == null ? null : MapRegion(registry.Region),
            HealthZone = registry.HealthZone,
            Tier = registry.Tier,
            Category = registry.Category.ToString(),
            PotentialAdjustment = ToDecimalString(registry.PotentialAdjustment),
            IsActive = registry.IsActive,
            SourceFile = registry.SourceFile,
            TerritoryId = registry.TerritoryId,
            Territory = registry.Territory == null ? null : MapTerritoryRecord(registry.Territory),
            TerritorySource = registry.TerritorySource.ToString(),
            CreatedAt = registry.CreatedAt,
            UpdatedAt = registry.UpdatedAt,
            Metrics = registry.Metrics.Select(MapMetric).ToList()
        };
    }

    private static TerritoryRecordDto MapTerritoryRecord(Territory territory)
    {
        return new TerritoryRecordDto
        {
            Id = territory.Id,
            Name = territory.Name,
            Code = territory.Code,
            RegionId = territory.RegionId,
            SortOrder = territory.SortOrder,
            IsActive = territory.IsActive,
            Note = territory.Note,
            CreatedAt = territory.CreatedAt,
            UpdatedAt = territory.UpdatedAt
        };
    }

    private static HospitalRegistryMetricDto MapMetric(HospitalPotentialMetric metric)
    {
        return new HospitalRegistryMetricDto
        {
            Id = metric.Id,
            HospitalRegistryId = metric.HospitalRegistryId,
            Metric = metric.Metric.ToString(),
            Value = ToDecimalString(metric.Value),
            PeriodYear = metric.PeriodYear,
            PeriodMonth = metric.PeriodMonth,
            SourceFile = metric.SourceFile,
            CreatedAt = metric.CreatedAt
        };
    }

    private static string ToDecimalString(decimal value) => value.ToString(CultureInfo.InvariantCulture);

    // ---- Registry links ----

    public async Task<HospitalRegistryLinksResponse> ListRegistryLinksAsync(string? status, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.HospitalRegistryLinks
            .AsNoTracking()
            .Include(l => l.Hospital)
            .ThenInclude(h => h.ProvinceMapping)
            .ThenInclude(p => p!.Region)
            .Include(l => l.HospitalRegistry)
            .ThenInclude(r => r!.ProvinceMapping)
            .ThenInclude(p => p!.Region)
            .Include(l => l.HospitalRegistry)
            .ThenInclude(r => r!.Territory)
            .Include(l => l.ReviewedBy)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<RegistryLinkStatus>(status, ignoreCase: false, out var parsed))
        {
            query = query.Where(l => l.Status == parsed);
        }
        else if (!string.IsNullOrEmpty(status))
        {
            throw new ValidationException("Validation failed", $"status must be one of UNREVIEWED, LINKED, CONFIRMED_ABSENT (got '{status}')");
        }

        var links = await query
            .OrderBy(l => l.Status)
            .ThenByDescending(l => l.UpdatedAt)
            .ToListAsync(cancellationToken);

        return new HospitalRegistryLinksResponse
        {
            HospitalRegistryLinks = links.Select(MapLink).ToList()
        };
    }

    public async Task<HospitalRegistryLinkResponse> UpdateRegistryLinkAsync(int hospitalId, UpdateRegistryLinkRequest request, int reviewedById, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<RegistryLinkStatus>(request.Status, ignoreCase: false, out var status) ||
            (status != RegistryLinkStatus.LINKED && status != RegistryLinkStatus.CONFIRMED_ABSENT))
        {
            throw new ValidationException("Validation failed", "status must be LINKED or CONFIRMED_ABSENT");
        }

        if (status == RegistryLinkStatus.LINKED && !request.HospitalRegistryId.HasValue)
        {
            throw new ValidationException("Validation failed", "Required when status is LINKED");
        }

        // The Zod contract requires hospitalRegistryId to be explicitly null when confirming absence
        // (an absent field fails `hospitalRegistryId !== null`).
        if (status == RegistryLinkStatus.CONFIRMED_ABSENT && (!request.HasHospitalRegistryId || request.HospitalRegistryId != null))
        {
            throw new ValidationException("Validation failed", "Must be null when confirming absence");
        }

        var hospital = await _dbContext.Hospitals
            .FirstOrDefaultAsync(h => h.Id == hospitalId, cancellationToken);

        if (hospital == null)
        {
            throw new NotFoundException("Hospital not found");
        }

        if (status == RegistryLinkStatus.LINKED && request.HospitalRegistryId.HasValue &&
            !await _dbContext.HospitalRegistries.AnyAsync(r => r.Id == request.HospitalRegistryId.Value, cancellationToken))
        {
            throw new NotFoundException("Hospital registry not found");
        }

        var link = await _dbContext.HospitalRegistryLinks
            .FirstOrDefaultAsync(l => l.HospitalId == hospitalId, cancellationToken);

        if (link == null)
        {
            link = new HospitalRegistryLink
            {
                HospitalId = hospitalId,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.HospitalRegistryLinks.Add(link);
        }

        link.HospitalRegistryId = status == RegistryLinkStatus.LINKED ? request.HospitalRegistryId : null;
        link.Status = status;
        link.Method = RegistryLinkMethod.MANUAL;
        link.Confidence = status == RegistryLinkStatus.LINKED ? 1m : null;
        link.ReviewedById = reviewedById;
        link.ReviewedAt = DateTime.UtcNow;
        link.Note = request.HasNote ? request.Note : null;
        link.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Response include matches the TypeScript upsert: hospital (no provinceMapping),
        // hospitalRegistry (bare), reviewedBy (id + displayName).
        var saved = await _dbContext.HospitalRegistryLinks
            .AsNoTracking()
            .Include(l => l.Hospital)
            .Include(l => l.HospitalRegistry)
            .Include(l => l.ReviewedBy)
            .FirstAsync(l => l.Id == link.Id, cancellationToken);

        return new HospitalRegistryLinkResponse { HospitalRegistryLink = MapLink(saved) };
    }

    private static HospitalRegistryLinkDto MapLink(HospitalRegistryLink link)
    {
        return new HospitalRegistryLinkDto
        {
            Id = link.Id,
            HospitalId = link.HospitalId,
            HospitalRegistryId = link.HospitalRegistryId,
            Status = link.Status.ToString(),
            Method = link.Method?.ToString(),
            Confidence = link.Confidence?.ToString(CultureInfo.InvariantCulture),
            ReviewedById = link.ReviewedById,
            ReviewedBy = link.ReviewedBy == null
                ? null
                : new Contracts.Territories.UserSummaryDto { Id = link.ReviewedBy.Id, DisplayName = link.ReviewedBy.DisplayName },
            ReviewedAt = link.ReviewedAt,
            Note = link.Note,
            CreatedAt = link.CreatedAt,
            UpdatedAt = link.UpdatedAt,
            Hospital = new LinkHospitalDto
            {
                Id = link.Hospital.Id,
                DisplayName = link.Hospital.DisplayName,
                Province = link.Hospital.Province,
                ProvinceMapping = link.Hospital.ProvinceMapping == null ? null : MapProvince(link.Hospital.ProvinceMapping)
            },
            HospitalRegistry = link.HospitalRegistry == null ? null : MapRegistry(link.HospitalRegistry)
        };
    }
}
