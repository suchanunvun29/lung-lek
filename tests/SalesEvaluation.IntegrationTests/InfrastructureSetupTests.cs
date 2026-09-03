namespace SalesEvaluation.IntegrationTests;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SalesEvaluation.Infrastructure;
using Xunit;

public class InfrastructureSetupTests
{
    [Fact]
    public void AddInfrastructureServices_ShouldRegisterServicesSuccessfully()
    {
        // Arrange
        var services = new ServiceCollection();
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"ConnectionStrings:DefaultConnection", "Host=localhost;Database=sales_eval;Username=postgres;Password=postgres"}
        };

        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        // Act
        services.AddInfrastructureServices(configuration);
        var provider = services.BuildServiceProvider();

        // Assert
        Assert.NotNull(provider);
    }
}
