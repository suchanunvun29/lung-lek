namespace SalesEvaluation.Application.Tests;

using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class DependencyInjectionTests
{
    [Fact]
    public void AddApplicationServices_ShouldRegisterServicesSuccessfully()
    {
        // Arrange
        var services = new ServiceCollection();

        // Act
        services.AddApplicationServices();
        var provider = services.BuildServiceProvider();

        // Assert
        Assert.NotNull(provider);
    }
}
