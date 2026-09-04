namespace SalesEvaluation.Application.HospitalRegistry;

using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.HospitalRegistry;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Domain.MasterData;

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
            throw new ValidationException("Validation failed: Provide canonicalName or regionId");
        }

        if (request.HasRegionId && request.RegionId.HasValue &&
            !await _dbContext.Regions.AnyAsync(r => r.Id == request.RegionId.Value, cancellationToken))
        {
            throw new NotFoundException("Region not found");
        }

        if (request.HasCanonicalName && request.CanonicalName != null)
        {
            province.CanonicalName = request.CanonicalName;
        }

        if (request.HasRegionId && request.RegionId.HasValue)
        {
            province.RegionId = request.RegionId.Value;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var saved = await _dbContext.ProvinceMappings
            .AsNoTracking()
            .Include(p => p.Region)
            .FirstAsync(p => p.Id == province.Id, cancellationToken);

        return new ProvinceResponse { Province = MapProvince(saved) };
    }

    private static ProvinceMappingDto MapProvince(ProvinceMapping p)
    {
        return new ProvinceMappingDto
        {
            Id = p.Id,
            CanonicalName = p.CanonicalName,
            RegionId = p.RegionId,
            Region = MapRegion(p.Region),
            CreatedAt = p.CreatedAt
        };
    }

    private static RegionDto MapRegion(Region r)
    {
        return new RegionDto
        {
            Id = r.Id,
            Name = r.Name,
            SortOrder = r.SortOrder,
            CreatedAt = r.CreatedAt
        };
    }

    // ---- Hospital Registries ----

    public async Task<HospitalRegistriesResponse> ListHospitalRegistriesAsync(
        string? q,
        int? provinceMappingId,
        int? territoryId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.HospitalRegistries
            .AsNoTracking()
            .Include(h => h.ProvinceMapping).ThenInclude(p => p!.Region)
            .Include(h => h.Region)
            .Include(h => h.Territory)
            .Include(h => h.Metrics)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(h =>
                (h.SourceCode != null && h.SourceCode.ToLower().Contains(term)) ||
                h.NameInFile.ToLower().Contains(term) ||
                h.DisplayName.ToLower().Contains(term));
        }

        if (provinceMappingId.HasValue)
        {
            query = query.Where(h => h.ProvinceMappingId == provinceMappingId.Value);
        }

        if (territoryId.HasValue)
        {
            query = query.Where(h => h.TerritoryId == territoryId.Value);
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(h => h.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new HospitalRegistriesResponse
        {
            HospitalRegistries = items.Select(MapRegistry).ToList(),
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PotentialAdjustmentResponse> UpdatePotentialAdjustmentAsync(
        int id,
        decimal potentialAdjustment,
        CancellationToken cancellationToken = default)
    {
        if (potentialAdjustment < 0)
        {
            throw new ValidationException("Validation failed: potentialAdjustment must be a non-negative number");
        }

        var registry = await _dbContext.HospitalRegistries
            .FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        if (registry == null)
        {
            throw new NotFoundException("Hospital registry not found");
        }

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
            throw new ValidationException($"Validation failed: status must be one of UNREVIEWED, LINKED, CONFIRMED_ABSENT (got '{status}')");
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
            throw new ValidationException("Validation failed: status must be LINKED or CONFIRMED_ABSENT");
        }

        if (status == RegistryLinkStatus.LINKED && !request.HospitalRegistryId.HasValue)
        {
            throw new ValidationException("Validation failed: Required when status is LINKED");
        }

        // The Zod contract requires hospitalRegistryId to be explicitly null when confirming absence
        if (status == RegistryLinkStatus.CONFIRMED_ABSENT && (!request.HasHospitalRegistryId || request.HospitalRegistryId != null))
        {
            throw new ValidationException("Validation failed: Must be null when confirming absence");
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
                HospitalRegistryId = status == RegistryLinkStatus.LINKED ? request.HospitalRegistryId : null,
                Status = status,
                Method = RegistryLinkMethod.MANUAL,
                Confidence = status == RegistryLinkStatus.LINKED ? 1m : null,
                ReviewedById = reviewedById,
                ReviewedAt = DateTime.UtcNow,
                Note = request.HasNote ? request.Note : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.HospitalRegistryLinks.Add(link);
        }
        else
        {
            link.HospitalRegistryId = status == RegistryLinkStatus.LINKED ? request.HospitalRegistryId : null;
            link.Status = status;
            link.Method = RegistryLinkMethod.MANUAL;
            link.Confidence = status == RegistryLinkStatus.LINKED ? 1m : null;
            link.ReviewedById = reviewedById;
            link.ReviewedAt = DateTime.UtcNow;
            link.Note = request.HasNote ? request.Note : null;
            link.UpdatedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var saved = await _dbContext.HospitalRegistryLinks
            .AsNoTracking()
            .Include(l => l.Hospital)
            .Include(l => l.HospitalRegistry)
            .Include(l => l.ReviewedBy)
            .FirstAsync(l => l.Id == link.Id, cancellationToken);

        return new HospitalRegistryLinkResponse { HospitalRegistryLink = MapLink(saved) };
    }

    // ---- WACC-P0-005: Import Hospital Registry ----

    public async Task<RegistryImportResultDto> ImportHospitalRegistryAsync(
        byte[] fileBytes,
        string fileName,
        int fileSizeBytes,
        int uploadedById,
        CancellationToken cancellationToken = default)
    {
        var uploader = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == uploadedById, cancellationToken);

        var batch = new ImportBatch
        {
            FileName = fileName,
            FileSizeBytes = fileSizeBytes,
            UploadedById = uploadedById,
            StartedAt = DateTime.UtcNow,
            Status = ImportStatus.PROCESSING,
            Mode = ImportMode.APPEND
        };

        _dbContext.ImportBatches.Add(batch);
        await _dbContext.SaveChangesAsync(cancellationToken);

        int totalRows = 0;
        int insertedRows = 0;
        int updatedRows = 0;
        int skippedRows = 0;
        int errorRows = 0;
        var sheetsFound = new List<string>();
        var sheetsImported = new List<string>();

        try
        {
            using var stream = new MemoryStream(fileBytes);
            using var workbook = new ClosedXML.Excel.XLWorkbook(stream);

            foreach (var ws in workbook.Worksheets)
            {
                sheetsFound.Add(ws.Name);
            }

            var sheet = workbook.Worksheets.FirstOrDefault();
            if (sheet == null)
            {
                throw new ValidationException("Validation failed: Workbook contains no worksheets");
            }

            sheetsImported.Add(sheet.Name);

            // 1. Detect header row
            int headerRowIndex = -1;
            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            for (int r = 1; r <= Math.Min(10, sheet.LastRowUsed()?.RowNumber() ?? 1); r++)
            {
                var row = sheet.Row(r);
                var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                for (int c = 1; c <= (row.LastCellUsed()?.Address.ColumnNumber ?? 0); c++)
                {
                    var val = row.Cell(c).GetString().Trim();
                    if (!string.IsNullOrEmpty(val) && !map.ContainsKey(val))
                    {
                        map[val] = c;
                    }
                }

                // Check for core columns: name / hospital name / ชื่อโรงพยาบาล / รหัส
                if (map.Keys.Any(k => k.Contains("ชื่อ", StringComparison.OrdinalIgnoreCase) ||
                                     k.Contains("name", StringComparison.OrdinalIgnoreCase) ||
                                     k.Contains("hospital", StringComparison.OrdinalIgnoreCase)))
                {
                    headerRowIndex = r;
                    headerMap = map;
                    break;
                }
            }

            if (headerRowIndex == -1)
            {
                // Fallback: row 1
                headerRowIndex = 1;
                var row = sheet.Row(1);
                for (int c = 1; c <= (row.LastCellUsed()?.Address.ColumnNumber ?? 0); c++)
                {
                    var val = row.Cell(c).GetString().Trim();
                    if (!string.IsNullOrEmpty(val) && !headerMap.ContainsKey(val))
                    {
                        headerMap[val] = c;
                    }
                }
            }

            int Col(params string[] aliases)
            {
                foreach (var a in aliases)
                {
                    foreach (var kvp in headerMap)
                    {
                        if (kvp.Key.Equals(a, StringComparison.OrdinalIgnoreCase) ||
                            kvp.Key.Contains(a, StringComparison.OrdinalIgnoreCase))
                        {
                            return kvp.Value;
                        }
                    }
                }
                return -1;
            }

            var codeCol = Col("sourceCode", "code", "รหัส", "hcode", "hospitalCode");
            var nameCol = Col("displayName", "hospitalName", "name", "ชื่อโรงพยาบาล", "ชื่อ", "สถานพยาบาล");
            var provinceCol = Col("province", "จังหวัด", "provinceRaw");
            var healthZoneCol = Col("healthZone", "เขตสุขภาพ", "zone");
            var tierCol = Col("tier", "ระดับ", "level");
            var categoryCol = Col("category", "ประเภท", "สังกัด");

            // Cache province mappings and territories
            var provinces = await _dbContext.ProvinceMappings
                .Include(p => p.Aliases)
                .Include(p => p.Region)
                .ToListAsync(cancellationToken);

            var provinceByNorm = new Dictionary<string, ProvinceMapping>();
            foreach (var p in provinces)
            {
                var norm = NameNormalizer.ThaiCore(p.CanonicalName);
                if (!string.IsNullOrEmpty(norm) && !provinceByNorm.ContainsKey(norm))
                    provinceByNorm[norm] = p;

                foreach (var a in p.Aliases)
                {
                    var aNorm = NameNormalizer.ThaiCore(a.NormalizedAlias);
                    if (!string.IsNullOrEmpty(aNorm) && !provinceByNorm.ContainsKey(aNorm))
                        provinceByNorm[aNorm] = p;
                }
            }

            var existingRegistries = await _dbContext.HospitalRegistries.ToListAsync(cancellationToken);
            var bySourceCode = existingRegistries
                .Where(r => !string.IsNullOrEmpty(r.SourceCode))
                .ToDictionary(r => r.SourceCode!, r => r, StringComparer.OrdinalIgnoreCase);

            var byNameAndProv = existingRegistries
                .ToDictionary(r => $"{r.NameInFile}|{r.ProvinceRaw}".ToLowerInvariant(), r => r);

            var lastRow = sheet.LastRowUsed()?.RowNumber() ?? headerRowIndex;
            var touchedRegistries = new List<HospitalRegistry>();

            for (int r = headerRowIndex + 1; r <= lastRow; r++)
            {
                var row = sheet.Row(r);
                if (row.IsEmpty()) continue;

                var rawName = nameCol > 0 ? row.Cell(nameCol).GetString().Trim() : string.Empty;
                if (string.IsNullOrWhiteSpace(rawName))
                {
                    skippedRows++;
                    continue;
                }

                totalRows++;

                var rawCode = codeCol > 0 ? row.Cell(codeCol).GetString().Trim() : null;
                if (string.IsNullOrWhiteSpace(rawCode)) rawCode = null;

                var rawProvince = provinceCol > 0 ? row.Cell(provinceCol).GetString().Trim() : string.Empty;
                var rawZone = healthZoneCol > 0 ? row.Cell(healthZoneCol).GetString().Trim() : null;
                var rawTier = tierCol > 0 ? row.Cell(tierCol).GetString().Trim() : null;
                var rawCategory = categoryCol > 0 ? row.Cell(categoryCol).GetString().Trim() : null;

                // Match province
                ProvinceMapping? matchedProvince = null;
                if (!string.IsNullOrWhiteSpace(rawProvince))
                {
                    var provNorm = NameNormalizer.ThaiCore(rawProvince);
                    provinceByNorm.TryGetValue(provNorm, out matchedProvince);
                }

                // Match existing registry
                HospitalRegistry? reg = null;
                if (rawCode != null && bySourceCode.TryGetValue(rawCode, out var byCode))
                {
                    reg = byCode;
                }
                else if (byNameAndProv.TryGetValue($"{rawName}|{rawProvince}".ToLowerInvariant(), out var byNP))
                {
                    reg = byNP;
                }

                var cat = HospitalCategory.GOVERNMENT_GENERAL;
                if (!string.IsNullOrWhiteSpace(rawCategory) && Enum.TryParse<HospitalCategory>(rawCategory, true, out var parsedCat))
                {
                    cat = parsedCat;
                }

                if (reg == null)
                {
                    reg = new HospitalRegistry
                    {
                        SourceCode = rawCode,
                        NameInFile = rawName,
                        DisplayName = rawName,
                        ProvinceRaw = rawProvince,
                        ProvinceMappingId = matchedProvince?.Id,
                        RegionId = matchedProvince?.RegionId,
                        HealthZone = string.IsNullOrWhiteSpace(rawZone) ? null : rawZone,
                        Tier = string.IsNullOrWhiteSpace(rawTier) ? null : rawTier,
                        Category = cat,
                        SourceFile = fileName,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.HospitalRegistries.Add(reg);
                    insertedRows++;
                }
                else
                {
                    if (rawCode != null) reg.SourceCode = rawCode;
                    reg.DisplayName = rawName;
                    if (!string.IsNullOrWhiteSpace(rawProvince)) reg.ProvinceRaw = rawProvince;
                    if (matchedProvince != null)
                    {
                        reg.ProvinceMappingId = matchedProvince.Id;
                        reg.RegionId = matchedProvince.RegionId;
                    }
                    if (!string.IsNullOrWhiteSpace(rawZone)) reg.HealthZone = rawZone;
                    if (!string.IsNullOrWhiteSpace(rawTier)) reg.Tier = rawTier;
                    reg.Category = cat;
                    reg.SourceFile = fileName;
                    reg.UpdatedAt = DateTime.UtcNow;
                    updatedRows++;
                }

                touchedRegistries.Add(reg);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            // 2. Perform HospitalRegistryLink matching for Hospital records
            var allHospitals = await _dbContext.Hospitals
                .Include(h => h.RegistryLink)
                .ToListAsync(cancellationToken);

            var savedRegistries = await _dbContext.HospitalRegistries.ToListAsync(cancellationToken);
            var regByThaiCore = new Dictionary<string, HospitalRegistry>();
            var regBySourceCode = new Dictionary<string, HospitalRegistry>(StringComparer.OrdinalIgnoreCase);

            foreach (var r in savedRegistries)
            {
                if (!string.IsNullOrEmpty(r.SourceCode) && !regBySourceCode.ContainsKey(r.SourceCode))
                    regBySourceCode[r.SourceCode] = r;

                var tc = NameNormalizer.ThaiCore(r.DisplayName);
                if (!string.IsNullOrEmpty(tc) && !regByThaiCore.ContainsKey(tc))
                    regByThaiCore[tc] = r;
            }

            foreach (var h in allHospitals)
            {
                if (h.RegistryLink != null && h.RegistryLink.Status != RegistryLinkStatus.UNREVIEWED)
                {
                    // Do not override reviewed links
                    continue;
                }

                HospitalRegistry? match = null;
                var hThai = NameNormalizer.ThaiCore(h.DisplayName);
                if (!string.IsNullOrEmpty(hThai) && regByThaiCore.TryGetValue(hThai, out var m1))
                {
                    match = m1;
                }

                if (match != null)
                {
                    if (h.RegistryLink == null)
                    {
                        var link = new HospitalRegistryLink
                        {
                            HospitalId = h.Id,
                            HospitalRegistryId = match.Id,
                            Status = RegistryLinkStatus.UNREVIEWED,
                            Method = RegistryLinkMethod.NORMALIZED,
                            Confidence = 0.9m,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _dbContext.HospitalRegistryLinks.Add(link);
                    }
                    else if (h.RegistryLink.Status == RegistryLinkStatus.UNREVIEWED)
                    {
                        h.RegistryLink.HospitalRegistryId = match.Id;
                        h.RegistryLink.Method = RegistryLinkMethod.NORMALIZED;
                        h.RegistryLink.Confidence = 0.9m;
                        h.RegistryLink.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            batch.Status = ImportStatus.SUCCESS;
            batch.FinishedAt = DateTime.UtcNow;
            batch.TotalRows = totalRows;
            batch.InsertedRows = insertedRows;
            batch.UpdatedRows = updatedRows;
            batch.SkippedRows = skippedRows;
            batch.ErrorRows = errorRows;
            batch.SheetsFound = JsonSerializer.Serialize(sheetsFound);
            batch.SheetsImported = JsonSerializer.Serialize(sheetsImported);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            batch.Status = ImportStatus.FAILED;
            batch.FinishedAt = DateTime.UtcNow;
            batch.ErrorMessage = ex.Message;
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw;
        }

        // Count linked and unreviewed links
        var linkedCount = await _dbContext.HospitalRegistryLinks
            .CountAsync(l => l.HospitalRegistryId != null, cancellationToken);
        var unreviewedCount = await _dbContext.HospitalRegistryLinks
            .CountAsync(l => l.Status == RegistryLinkStatus.UNREVIEWED, cancellationToken);

        return new RegistryImportResultDto
        {
            ImportBatch = new RegistryImportBatchDto
            {
                Id = batch.Id,
                FileName = batch.FileName,
                FileSizeBytes = batch.FileSizeBytes,
                UploadedById = batch.UploadedById,
                UploadedBy = uploader == null ? null : new UserSummaryDto
                {
                    Id = uploader.Id,
                    DisplayName = uploader.DisplayName,
                    Email = uploader.Email
                },
                StartedAt = batch.StartedAt.ToString("o"),
                FinishedAt = batch.FinishedAt?.ToString("o"),
                Status = batch.Status.ToString(),
                SheetsFound = sheetsFound,
                SheetsImported = sheetsImported,
                TotalRows = batch.TotalRows,
                InsertedRows = batch.InsertedRows,
                UpdatedRows = batch.UpdatedRows,
                SkippedRows = batch.SkippedRows,
                ErrorRows = batch.ErrorRows,
                Mode = batch.Mode.ToString(),
                TargetPeriods = null,
                RemovedRows = batch.RemovedRows,
                ConfirmedById = batch.ConfirmedById,
                PeriodsTouched = null,
                ErrorMessage = batch.ErrorMessage
            },
            Links = new RegistryImportLinksSummaryDto
            {
                Linked = linkedCount,
                Unreviewed = unreviewedCount
            }
        };
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
