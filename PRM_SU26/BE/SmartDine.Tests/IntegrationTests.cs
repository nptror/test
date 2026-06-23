using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using SmartDine.Application.DTOs.Auth;
using SmartDine.Application.DTOs.Common;
using SmartDine.Application.DTOs.Menu;
using SmartDine.Application.DTOs.Orders;
using SmartDine.Application.DTOs.Tables;
using SmartDine.Domain.Entities;
using SmartDine.Infrastructure.Persistence;
using Xunit;

namespace SmartDine.Tests;

public class IntegrationTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly CustomWebApplicationFactory<Program> _factory;

    public IntegrationTests(CustomWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Auth_Flow_Should_Register_And_Login_Successfully()
    {
        // Arrange
        var client = _factory.CreateClient();
        var email = $"customer_{Guid.NewGuid()}@example.com";
        var registerRequest = new RegisterRequest
        {
            FullName = "Test Customer",
            Email = email,
            Password = "Password123!",
            PhoneNumber = $"09{Guid.NewGuid().ToString()[..8]}"
        };

        // Act - Register
        var registerResponse = await client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        
        // Assert
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        var registerResult = await registerResponse.Content.ReadFromJsonAsync<ApiResponse<TokenResponse>>();
        Assert.NotNull(registerResult);
        Assert.True(registerResult.Success);
        Assert.NotNull(registerResult.Data!.AccessToken);

        // Act - Login
        var loginRequest = new LoginRequest { Email = email, Password = "Password123!" };
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginResult = await loginResponse.Content.ReadFromJsonAsync<ApiResponse<TokenResponse>>();
        Assert.NotNull(loginResult);
        Assert.True(loginResult.Success);
        Assert.NotNull(loginResult.Data!.AccessToken);

        // Act - Get Current User
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.Data.AccessToken);
        var meResponse = await client.GetAsync("/api/v1/auth/me");

        // Assert
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var meResult = await meResponse.Content.ReadFromJsonAsync<ApiResponse<UserInfoResponse>>();
        Assert.NotNull(meResult);
        Assert.True(meResult.Success);
        Assert.Equal(email, meResult.Data!.Email);
    }

    [Fact]
    public async Task Tables_And_Orders_Flow_Should_Work_For_Authorized_Users()
    {
        // Arrange
        var client = _factory.CreateClient();

        // 1. Log in as Manager to get tables and menu items
        var adminLoginRequest = new LoginRequest { Email = "admin@smartdine.com", Password = "Password123!" };
        var adminLoginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", adminLoginRequest);
        var adminLoginResult = await adminLoginResponse.Content.ReadFromJsonAsync<ApiResponse<TokenResponse>>();
        
        Assert.NotNull(adminLoginResult);
        Assert.True(adminLoginResult.Success);
        
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminLoginResult.Data!.AccessToken);

        // 2. Fetch tables
        var tablesResponse = await client.GetAsync("/api/v1/tables");
        Assert.Equal(HttpStatusCode.OK, tablesResponse.StatusCode);
        var tablesResult = await tablesResponse.Content.ReadFromJsonAsync<ApiResponse<List<TableResponse>>>();
        
        Assert.NotNull(tablesResult);
        Assert.True(tablesResult.Success);
        Assert.NotEmpty(tablesResult.Data!);

        // 3. Fetch menu items (public)
        var menuResponse = await client.GetAsync("/api/v1/menu-items");
        Assert.Equal(HttpStatusCode.OK, menuResponse.StatusCode);
        var menuResult = await menuResponse.Content.ReadFromJsonAsync<ApiResponse<List<MenuItemResponse>>>();
        
        Assert.NotNull(menuResult);
        Assert.True(menuResult.Success);
        Assert.NotEmpty(menuResult.Data!);

        // 4. Register a new customer
        var customerEmail = $"order_customer_{Guid.NewGuid()}@example.com";
        var registerRequest = new RegisterRequest
        {
            FullName = "Dining Customer",
            Email = customerEmail,
            Password = "Password123!",
            PhoneNumber = $"09{Guid.NewGuid().ToString()[..8]}"
        };
        var registerResponse = await client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        var registerResult = await registerResponse.Content.ReadFromJsonAsync<ApiResponse<TokenResponse>>();
        
        Assert.NotNull(registerResult);
        Assert.True(registerResult.Success);

        // Use customer token to place order
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", registerResult.Data!.AccessToken);

        // 5. Place order request setup
        var targetMenuItemIds = new List<int> { menuResult.Data![0].Id, menuResult.Data![1].Id };
        var placeOrderRequest = new PlaceOrderRequest
        {
            TableId = tablesResult.Data![0].Id,
            Items = targetMenuItemIds.Select(id => new OrderDetailRequest { MenuItemId = id, Quantity = 1 }).ToList()
        };

        // Create an active DiningSession for this new customer in the DB first
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SmartDineDbContext>();
            var customer = db.Customers.First(c => c.Email == customerEmail);
            var table = db.Tables.First(t => t.Id == tablesResult.Data![0].Id);
            
            var session = new DiningSession
            {
                CustomerId = customer.Id,
                TableId = table.Id,
                GuestName = customer.FullName,
                GuestPhone = customer.Phone,
                Status = "ACTIVE",
                TotalSpent = 0.00m
            };
            db.DiningSessions.Add(session);
            db.SaveChanges();
            
            placeOrderRequest.DiningSessionId = session.Id;
        }

        var orderResponse = await client.PostAsJsonAsync("/api/v1/orders", placeOrderRequest);
        
        // Assert
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var orderResult = await orderResponse.Content.ReadFromJsonAsync<ApiResponse<OrderResponse>>();
        Assert.NotNull(orderResult);
        Assert.True(orderResult.Success);
        Assert.NotNull(orderResult.Data);
        Assert.Equal("PENDING", orderResult.Data.Status);
    }
}
