namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Salespeople;

public interface ISalespersonService
{
    Task<SalespeopleResponse> ListSalespeopleAsync(CurrentUser currentUser, CancellationToken cancellationToken = default);
    Task<SalespersonResponse> UpdateSalespersonAsync(string id, UpdateSalespersonRequest request, CancellationToken cancellationToken = default);
}
