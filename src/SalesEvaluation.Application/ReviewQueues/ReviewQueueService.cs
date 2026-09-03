namespace SalesEvaluation.Application.ReviewQueues;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.ReviewQueues;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Domain.MasterData;

public class ReviewQueueService : IReviewQueueService
{
    private const decimal SharePercentTotal = 100m;
    private const decimal SharePercentEpsilon = 0.001m;
    private readonly IAppDbContext _dbContext;

    public ReviewQueueService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HospitalNameReviewsResponse> ListPendingHospitalNameReviewsAsync(CancellationToken cancellationToken = default)
    {
        var reviews = await _dbContext.HospitalNameReviews
            .AsNoTracking()
            .Where(r => r.Status == NameReviewStatus.PENDING)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return new HospitalNameReviewsResponse
        {
            HospitalNameReviews = reviews.Select(MapToDto).ToList()
        };
    }

    public async Task<HospitalNameReviewResponse> DecideHospitalNameReviewAsync(string id, DecideHospitalNameReviewRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Review ID is required");
        }

        var review = await _dbContext.HospitalNameReviews
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (review == null)
        {
            throw new NotFoundException("Hospital name review not found");
        }

        if (review.Status != NameReviewStatus.PENDING)
        {
            throw new ConflictException($"รายการนี้ถูกตัดสินไปแล้ว ({review.Status})");
        }

        var decidedById = userId;
        var decidedAt = DateTime.UtcNow;

        if (request.Decision == "KEPT_SEPARATE")
        {
            review.Status = NameReviewStatus.KEPT_SEPARATE;
            review.DecidedById = decidedById;
            review.DecidedAt = decidedAt;
            review.Note = request.Note;

            await _dbContext.SaveChangesAsync(cancellationToken);

            return new HospitalNameReviewResponse
            {
                HospitalNameReview = MapToDto(review)
            };
        }

        if (request.Decision != "MERGED")
        {
            throw new ValidationException("Validation failed", "Decision must be MERGED or KEPT_SEPARATE");
        }

        var aliasA = await _dbContext.HospitalAliases
            .FirstOrDefaultAsync(a => a.NormalizedKey == review.NormalizedKeyA, cancellationToken);

        var aliasB = await _dbContext.HospitalAliases
            .FirstOrDefaultAsync(a => a.NormalizedKey == review.NormalizedKeyB, cancellationToken);

        if (aliasA == null || aliasB == null)
        {
            throw new InvalidOperationException("ไม่พบ HospitalAlias ที่สอดคล้องกับคู่ที่รอตัดสิน — ข้อมูลไม่สอดคล้องกัน");
        }

        if (aliasA.HospitalId == aliasB.HospitalId)
        {
            review.Status = NameReviewStatus.MERGED;
            review.MergedIntoId = aliasA.HospitalId;
            review.DecidedById = decidedById;
            review.DecidedAt = decidedAt;
            review.Note = request.Note;

            await _dbContext.SaveChangesAsync(cancellationToken);

            return new HospitalNameReviewResponse
            {
                HospitalNameReview = MapToDto(review)
            };
        }

        var canonicalId = !string.IsNullOrWhiteSpace(request.MergedIntoId)
            ? request.MergedIntoId
            : aliasA.HospitalId;

        if (canonicalId != aliasA.HospitalId && canonicalId != aliasB.HospitalId)
        {
            throw new ValidationException("Validation failed", "mergedIntoId ต้องเป็นหนึ่งในสองโรงพยาบาลที่รอตัดสินเท่านั้น");
        }

        var duplicateId = canonicalId == aliasA.HospitalId ? aliasB.HospitalId : aliasA.HospitalId;

        // Repoint aliases
        var duplicateAliases = await _dbContext.HospitalAliases
            .Where(a => a.HospitalId == duplicateId)
            .ToListAsync(cancellationToken);

        foreach (var alias in duplicateAliases)
        {
            alias.HospitalId = canonicalId;
        }

        // Repoint sales lines
        var duplicateSalesLines = await _dbContext.SalesLines
            .Where(sl => sl.HospitalId == duplicateId)
            .ToListAsync(cancellationToken);

        foreach (var salesLine in duplicateSalesLines)
        {
            salesLine.HospitalId = canonicalId;
        }

        // Remove duplicate hospital
        var duplicateHospital = await _dbContext.Hospitals
            .FirstOrDefaultAsync(h => h.Id == duplicateId, cancellationToken);

        if (duplicateHospital != null)
        {
            _dbContext.Hospitals.Remove(duplicateHospital);
        }

        // Update review record
        review.Status = NameReviewStatus.MERGED;
        review.MergedIntoId = canonicalId;
        review.DecidedById = decidedById;
        review.DecidedAt = decidedAt;
        review.Note = request.Note;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new HospitalNameReviewResponse
        {
            HospitalNameReview = MapToDto(review)
        };
    }

    public async Task<SalesmanNameReviewsResponse> ListPendingSalesmanNameReviewsAsync(CancellationToken cancellationToken = default)
    {
        var reviews = await _dbContext.SalesmanNameReviews
            .AsNoTracking()
            .Where(r => r.Status == NameReviewStatus.PENDING)
            .Include(r => r.CreatedSalesperson)
            .Include(r => r.MergedInto)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return new SalesmanNameReviewsResponse
        {
            SalesmanNameReviews = reviews.Select(MapSalesmanReviewToDto).ToList()
        };
    }

    public async Task<SalesmanNameReviewResponse> DecideSalesmanNameReviewAsync(string id, DecideSalesmanNameReviewRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Review ID is required");
        }

        var review = await _dbContext.SalesmanNameReviews
            .Include(r => r.CreatedSalesperson)
            .Include(r => r.MergedInto)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (review == null)
        {
            throw new NotFoundException("Salesman name review not found");
        }

        if (review.Status != NameReviewStatus.PENDING)
        {
            throw new ConflictException($"รายการนี้ถูกตัดสินไปแล้ว ({review.Status})");
        }

        var decidedById = userId;
        var decidedAt = DateTime.UtcNow;

        if (request.Decision == "KEPT_SEPARATE")
        {
            review.Status = NameReviewStatus.KEPT_SEPARATE;
            review.DecidedById = decidedById;
            review.DecidedAt = decidedAt;
            review.Note = request.Note;

            await _dbContext.SaveChangesAsync(cancellationToken);

            return new SalesmanNameReviewResponse
            {
                SalesmanNameReview = MapSalesmanReviewToDto(review)
            };
        }

        if (request.Decision != "MERGED")
        {
            throw new ValidationException("Validation failed", "Decision must be MERGED or KEPT_SEPARATE");
        }

        var fromId = review.CreatedSalespersonId;
        if (string.IsNullOrWhiteSpace(fromId) || review.CreatedSalesperson == null)
        {
            throw new ConflictException("แถวพนักงานขายที่ถูกสร้างจากชื่อนี้ไม่มีอยู่แล้ว จึงรวมไม่ได้ — กรุณาตัดสินใหม่หรือลบคิวนี้");
        }

        if (string.IsNullOrWhiteSpace(request.MergedIntoId))
        {
            throw new ValidationException("Validation failed", "mergedIntoId is required for MERGED decision");
        }

        if (request.MergedIntoId == fromId)
        {
            throw new ValidationException("Validation failed", "mergedIntoId ต้องไม่ชี้ตัวเดิมที่ถูกสร้างซ้ำ");
        }

        var targetSalesperson = await _dbContext.Salespeople
            .FirstOrDefaultAsync(s => s.Id == request.MergedIntoId, cancellationToken);

        if (targetSalesperson == null)
        {
            throw new NotFoundException("Salesperson not found");
        }

        // Repoint all related records
        var salesLines = await _dbContext.SalesLines
            .Where(sl => sl.SalespersonId == fromId)
            .ToListAsync(cancellationToken);
        foreach (var sl in salesLines)
        {
            sl.SalespersonId = request.MergedIntoId;
        }

        var credits = await _dbContext.SalesLineCredits
            .Where(c => c.SalespersonId == fromId)
            .ToListAsync(cancellationToken);
        foreach (var c in credits)
        {
            c.SalespersonId = request.MergedIntoId;
        }

        var targets = await _dbContext.Targets
            .Where(t => t.SalespersonId == fromId)
            .ToListAsync(cancellationToken);
        foreach (var t in targets)
        {
            t.SalespersonId = request.MergedIntoId;
        }

        var insights = await _dbContext.CoachingInsights
            .Where(ci => ci.SalespersonId == fromId)
            .ToListAsync(cancellationToken);
        foreach (var ci in insights)
        {
            ci.SalespersonId = request.MergedIntoId;
        }

        var assignments = await _dbContext.TerritoryAssignments
            .Where(ta => ta.SalespersonId == fromId)
            .ToListAsync(cancellationToken);
        foreach (var ta in assignments)
        {
            ta.SalespersonId = request.MergedIntoId;
        }

        // Update review record
        review.Status = NameReviewStatus.MERGED;
        review.MergedIntoId = request.MergedIntoId;
        review.DecidedById = decidedById;
        review.DecidedAt = decidedAt;
        review.Note = request.Note;
        review.MergedInto = targetSalesperson;

        // Delete duplicate salesperson row
        var duplicateSalesperson = await _dbContext.Salespeople
            .FirstOrDefaultAsync(s => s.Id == fromId, cancellationToken);

        if (duplicateSalesperson != null)
        {
            _dbContext.Salespeople.Remove(duplicateSalesperson);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SalesmanNameReviewResponse
        {
            SalesmanNameReview = MapSalesmanReviewToDto(review)
        };
    }

    public async Task<SalesmanNameRulesResponse> ListSalesmanNameRulesAsync(CancellationToken cancellationToken = default)
    {
        var rules = await _dbContext.SalesmanNameRules
            .AsNoTracking()
            .Include(r => r.Members)
                .ThenInclude(m => m.Salesperson)
            .Include(r => r.DecidedBy)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        return new SalesmanNameRulesResponse
        {
            SalesmanNameRules = rules.Select(MapRuleToDto).ToList()
        };
    }

    public async Task<SalesmanNameRuleResponse> CreateSalesmanNameRuleAsync(CreateSalesmanNameRuleRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.SampleRaw))
        {
            throw new ValidationException("Validation failed", "SampleRaw is required");
        }

        if (request.Members == null || request.Members.Count == 0)
        {
            throw new ValidationException("Validation failed", "Members list must not be empty");
        }

        var distinctIds = request.Members.Select(m => m.SalespersonId).Distinct().Count();
        if (distinctIds != request.Members.Count)
        {
            throw new ValidationException("Validation failed", "salespersonId ในสมาชิกห้ามซ้ำกัน");
        }

        var totalShare = request.Members.Sum(m => m.SharePercent);
        if (Math.Abs(totalShare - SharePercentTotal) > SharePercentEpsilon)
        {
            throw new ValidationException("Validation failed", "ผลรวม sharePercent ของสมาชิกต้องเท่ากับ 100 พอดี");
        }

        var splitNames = NameNormalizer.SplitSharedSalesmanNames(request.SampleRaw);
        var normalizedRaw = NameNormalizer.NormalizeSharedSalesmanRaw(splitNames);

        var existingRule = await _dbContext.SalesmanNameRules
            .FirstOrDefaultAsync(r => r.NormalizedRaw == normalizedRaw, cancellationToken);

        if (existingRule != null)
        {
            throw new ConflictException($"Salesman name rule for '{normalizedRaw}' already exists");
        }

        var rule = new SalesmanNameRule
        {
            Id = Guid.NewGuid().ToString(),
            NormalizedRaw = normalizedRaw,
            SampleRaw = request.SampleRaw.Trim(),
            DecidedById = userId,
            DecidedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var m in request.Members)
        {
            rule.Members.Add(new SalesmanNameRuleMember
            {
                Id = Guid.NewGuid().ToString(),
                RuleId = rule.Id,
                SalespersonId = m.SalespersonId,
                SharePercent = m.SharePercent
            });
        }

        _dbContext.SalesmanNameRules.Add(rule);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Load relations for response
        var created = await _dbContext.SalesmanNameRules
            .AsNoTracking()
            .Include(r => r.Members)
                .ThenInclude(m => m.Salesperson)
            .Include(r => r.DecidedBy)
            .FirstAsync(r => r.Id == rule.Id, cancellationToken);

        return new SalesmanNameRuleResponse
        {
            SalesmanNameRule = MapRuleToDto(created)
        };
    }

    public async Task<SalesmanNameRuleResponse> UpdateSalesmanNameRuleAsync(string id, UpdateSalesmanNameRuleRequest request, string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ValidationException("Validation failed", "Rule ID is required");
        }

        if (request.Members == null || request.Members.Count == 0)
        {
            throw new ValidationException("Validation failed", "Members list must not be empty");
        }

        var distinctIds = request.Members.Select(m => m.SalespersonId).Distinct().Count();
        if (distinctIds != request.Members.Count)
        {
            throw new ValidationException("Validation failed", "salespersonId ในสมาชิกห้ามซ้ำกัน");
        }

        var totalShare = request.Members.Sum(m => m.SharePercent);
        if (Math.Abs(totalShare - SharePercentTotal) > SharePercentEpsilon)
        {
            throw new ValidationException("Validation failed", "ผลรวม sharePercent ของสมาชิกต้องเท่ากับ 100 พอดี");
        }

        var rule = await _dbContext.SalesmanNameRules
            .Include(r => r.Members)
                .ThenInclude(m => m.Salesperson)
            .Include(r => r.DecidedBy)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (rule == null)
        {
            throw new NotFoundException("Salesman name rule not found");
        }

        var existingSalespersonIds = rule.Members.Select(m => m.SalespersonId).ToHashSet();
        var incomingSalespersonIds = request.Members.Select(m => m.SalespersonId).ToHashSet();

        if (existingSalespersonIds.Count != incomingSalespersonIds.Count || !existingSalespersonIds.SetEquals(incomingSalespersonIds))
        {
            throw new ValidationException("Validation failed", "แก้ได้เฉพาะสัดส่วนของสมาชิกเดิมเท่านั้น — เพิ่ม/ลบสมาชิกไม่ได้ผ่าน endpoint นี้");
        }

        foreach (var reqMember in request.Members)
        {
            var member = rule.Members.First(m => m.SalespersonId == reqMember.SalespersonId);
            member.SharePercent = reqMember.SharePercent;
        }

        rule.DecidedById = userId;
        rule.DecidedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload decider if changed
        rule.DecidedBy = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        return new SalesmanNameRuleResponse
        {
            SalesmanNameRule = MapRuleToDto(rule)
        };
    }

    private static HospitalNameReviewDto MapToDto(HospitalNameReview r)
    {
        return new HospitalNameReviewDto
        {
            Id = r.Id,
            NormalizedKeyA = r.NormalizedKeyA,
            NormalizedKeyB = r.NormalizedKeyB,
            SampleRawA = r.SampleRawA,
            SampleRawB = r.SampleRawB,
            Similarity = r.Similarity,
            Status = r.Status.ToString(),
            MergedIntoId = r.MergedIntoId,
            DecidedById = r.DecidedById,
            DecidedAt = r.DecidedAt,
            Note = r.Note,
            CreatedAt = r.CreatedAt
        };
    }

    private static SalesmanNameReviewDto MapSalesmanReviewToDto(SalesmanNameReview r)
    {
        return new SalesmanNameReviewDto
        {
            Id = r.Id,
            PersonKey = r.PersonKey,
            SampleRaw = r.SampleRaw,
            Status = r.Status.ToString(),
            CreatedSalespersonId = r.CreatedSalespersonId,
            CreatedSalesperson = r.CreatedSalesperson == null ? null : new SalespersonSummaryDto
            {
                Id = r.CreatedSalesperson.Id,
                NameInFile = r.CreatedSalesperson.NameInFile,
                DisplayName = r.CreatedSalesperson.DisplayName,
                IsActive = r.CreatedSalesperson.IsActive
            },
            MergedIntoId = r.MergedIntoId,
            MergedInto = r.MergedInto == null ? null : new SalespersonSummaryDto
            {
                Id = r.MergedInto.Id,
                NameInFile = r.MergedInto.NameInFile,
                DisplayName = r.MergedInto.DisplayName,
                IsActive = r.MergedInto.IsActive
            },
            DecidedById = r.DecidedById,
            DecidedAt = r.DecidedAt,
            Note = r.Note,
            CreatedAt = r.CreatedAt
        };
    }

    private static SalesmanNameRuleDto MapRuleToDto(SalesmanNameRule r)
    {
        return new SalesmanNameRuleDto
        {
            Id = r.Id,
            NormalizedRaw = r.NormalizedRaw,
            SampleRaw = r.SampleRaw,
            DecidedById = r.DecidedById,
            DecidedBy = r.DecidedBy == null ? null : new DeciderSummaryDto
            {
                Id = r.DecidedBy.Id,
                DisplayName = r.DecidedBy.DisplayName
            },
            DecidedAt = r.DecidedAt,
            CreatedAt = r.CreatedAt,
            Members = r.Members.Select(m => new SalesmanNameRuleMemberDto
            {
                Id = m.Id,
                RuleId = m.RuleId,
                SalespersonId = m.SalespersonId,
                SharePercent = m.SharePercent,
                Salesperson = m.Salesperson == null ? null! : new SalespersonSummaryDto
                {
                    Id = m.Salesperson.Id,
                    NameInFile = m.Salesperson.NameInFile,
                    DisplayName = m.Salesperson.DisplayName,
                    IsActive = m.Salesperson.IsActive
                }
            }).ToList()
        };
    }
}
