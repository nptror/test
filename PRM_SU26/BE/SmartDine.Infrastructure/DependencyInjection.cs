using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartDine.Domain.Interfaces;
using SmartDine.Infrastructure.Persistence;
using SmartDine.Infrastructure.Persistence.Repositories;
using SmartDine.Infrastructure.Security;

namespace SmartDine.Infrastructure;

/// <summary>
/// Extension method đăng ký tất cả services của Infrastructure layer.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        // PostgreSQL + EF Core
        if (configuration["UseInMemoryDatabase"] == "true")
        {
            services.AddDbContext<SmartDineDbContext>(options =>
                options.UseInMemoryDatabase("SmartDineTestDb"));
        }
        else
        {
            services.AddDbContext<SmartDineDbContext>(options =>
                options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));
        }

        // Repositories
        services.AddScoped(typeof(IRepository<>), typeof(GenericRepository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IMenuItemRepository, MenuItemRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<ITableRepository, TableRepository>();
        services.AddScoped<IDiningSessionRepository, DiningSessionRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<IReviewRepository, ReviewRepository>();

        // Security
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();

        // Seeder
        services.AddScoped<DbSeeder>();

        return services;
    }
}
