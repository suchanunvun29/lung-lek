namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.ReviewQueues;

public interface IReviewQueueService
{
    Task<HospitalNameReviewsResponse> ListPendingHospitalNameReviewsAsync(CancellationToken cancellationToken = default);
    Task<HospitalNameReviewResponse> DecideHospitalNameReviewAsync(string id, DecideHospitalNameReviewRequest request, string userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameReviewsResponse> ListPendingSalesmanNameReviewsAsync(CancellationToken cancellationToken = default);
    Task<SalesmanNameReviewResponse> DecideSalesmanNameReviewAsync(string id, DecideSalesmanNameReviewRequest request, string userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameRulesResponse> ListSalesmanNameRulesAsync(CancellationToken cancellationToken = default);
    Task<SalesmanNameRuleResponse> CreateSalesmanNameRuleAsync(CreateSalesmanNameRuleRequest request, string userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameRuleResponse> UpdateSalesmanNameRuleAsync(string id, UpdateSalesmanNameRuleRequest request, string userId, CancellationToken cancellationToken = default);
}
