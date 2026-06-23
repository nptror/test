namespace SmartDine.Domain.Interfaces;

/// <summary>
/// Unit of Work — quản lý transaction xuyên suốt nhiều repositories.
/// </summary>
public interface IUnitOfWork : IDisposable
{
    IOrderRepository Orders { get; }
    IMenuItemRepository MenuItems { get; }
    IUserRepository Users { get; }
    ICustomerRepository Customers { get; }
    ITableRepository Tables { get; }
    IDiningSessionRepository DiningSessions { get; }
    IPaymentRepository Payments { get; }
    IReviewRepository Reviews { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
