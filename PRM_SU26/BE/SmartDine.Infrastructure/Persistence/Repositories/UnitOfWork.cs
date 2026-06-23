using SmartDine.Domain.Interfaces;

namespace SmartDine.Infrastructure.Persistence.Repositories;

/// <summary>
/// Unit of Work — quản lý tất cả repositories trong 1 transaction.
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly SmartDineDbContext _context;

    public IOrderRepository Orders { get; }
    public IMenuItemRepository MenuItems { get; }
    public IUserRepository Users { get; }
    public ICustomerRepository Customers { get; }
    public ITableRepository Tables { get; }
    public IDiningSessionRepository DiningSessions { get; }
    public IPaymentRepository Payments { get; }
    public IReviewRepository Reviews { get; }

    public UnitOfWork(SmartDineDbContext context)
    {
        _context = context;
        Orders = new OrderRepository(context);
        MenuItems = new MenuItemRepository(context);
        Users = new UserRepository(context);
        Customers = new CustomerRepository(context);
        Tables = new TableRepository(context);
        DiningSessions = new DiningSessionRepository(context);
        Payments = new PaymentRepository(context);
        Reviews = new ReviewRepository(context);
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _context.SaveChangesAsync(ct);

    public void Dispose() => _context.Dispose();
}
