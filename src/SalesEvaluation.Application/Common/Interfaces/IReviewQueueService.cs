namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.ReviewQueues;

public interface IReviewQueueService
{
    Task<HospitalNameReviewsResponse> ListPendingHospitalNameReviewsAsync(CancellationToken cancellationToken = default);
    Task<HospitalNameReviewResponse> DecideHospitalNameReviewAsync(int id, DecideHospitalNameReviewRequest request, int userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameReviewsResponse> ListPendingSalesmanNameReviewsAsync(CancellationToken cancellationToken = default);
    Task<SalesmanNameReviewResponse> DecideSalesmanNameReviewAsync(int id, DecideSalesmanNameReviewRequest request, int userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameRulesResponse> ListSalesmanNameRulesAsync(CancellationToken cancellationToken = default);
    Task<SalesmanNameRuleResponse> CreateSalesmanNameRuleAsync(CreateSalesmanNameRuleRequest request, int userId, CancellationToken cancellationToken = default);
    Task<SalesmanNameRuleResponse> UpdateSalesmanNameRuleAsync(int id, UpdateSalesmanNameRuleRequest request, int userId, CancellationToken cancellationToken = default);
}
