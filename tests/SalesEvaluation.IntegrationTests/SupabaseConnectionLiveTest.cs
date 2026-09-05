namespace SalesEvaluation.IntegrationTests;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SalesEvaluation.Application;
using SalesEvaluation.Infrastructure;
using Xunit;

public class SupabaseConnectionLiveTest
{
    [Fact]
    public async Task CanConnectToSupabase()
    {
        var poolerHost = Environment.GetEnvironmentVariable("SUPABASE_POOLER_HOST")
            ?? throw new InvalidOperationException("Set SUPABASE_POOLER_HOST to run this live test");
        var poolerUser = Environment.GetEnvironmentVariable("SUPABASE_POOLER_USER")
            ?? throw new InvalidOperationException("Set SUPABASE_POOLER_USER to run this live test");
        var password = Environment.GetEnvironmentVariable("SUPABASE_POOLER_PASSWORD")
            ?? throw new InvalidOperationException("Set SUPABASE_POOLER_PASSWORD to run this live test");

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = poolerHost,
            Port = 5432,
            Database = "postgres",
            Username = poolerUser,
            Password = password,
            SslMode = SslMode.Require,
            Timeout = 10
        };

        var rawUrl = builder.ConnectionString;

        await using var conn = new NpgsqlConnection(builder.ConnectionString);
        await conn.OpenAsync();
        Assert.Equal(System.Data.ConnectionState.Open, conn.State);

        var services = new Microsoft.Extensions.DependencyInjection.ServiceCollection();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = rawUrl,
                ["Jwt:Secret"] = "super-secret-key-at-least-32-chars-long-123456",
                ["Jwt:Issuer"] = "SalesEvaluationApi",
                ["Jwt:Audience"] = "SalesEvaluationFrontend"
            })
            .Build();

        services.AddSingleton<IConfiguration>(config);
        services.AddInfrastructureServices(config);
        services.AddApplicationServices();

        var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<SalesEvaluation.Application.Common.Interfaces.IAuthService>();

        try
        {
            var res = await authService.LoginAsync(new SalesEvaluation.Contracts.Auth.LoginRequest
            {
                Email = "manager1@example.com",
                Password = "PassW0rd!"
            });
            Console.WriteLine("LOGIN SUCCESS! Token: " + res.Token);
        }
        catch (Exception ex)
        {
            Console.WriteLine("LOGIN FAILED WITH EXCEPTION: " + ex.ToString());
            throw;
        }
    }
}
