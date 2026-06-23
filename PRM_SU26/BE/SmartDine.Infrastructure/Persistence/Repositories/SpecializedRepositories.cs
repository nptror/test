using Microsoft.EntityFrameworkCore;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartDine.Infrastructure.Persistence.Repositories;

public class MenuItemRepository : GenericRepository<MenuItem>, IMenuItemRepository
{
    public MenuItemRepository(SmartDineDbContext context) : base(context) { }

    public async Task<IReadOnlyList<MenuItem>> GetByCategoryIdAsync(int categoryId) =>
        await _dbSet.Where(m => m.CategoryId == categoryId)
                    .OrderBy(m => m.Name).ToListAsync();

    public async Task<IReadOnlyList<MenuItem>> GetAvailableAsync() =>
        await _dbSet.Include(m => m.Category)
                    .Where(m => m.IsAvailable)
                    .OrderBy(m => m.Category.Name).ThenBy(m => m.Name)
                    .ToListAsync();

    public async Task<IReadOnlyList<MenuItem>> SearchAsync(string query) =>
        await _dbSet.Include(m => m.Category)
                    .Where(m => m.Name.ToLower().Contains(query.ToLower()) ||
                                (m.Description != null && m.Description.ToLower().Contains(query.ToLower())))
                    .ToListAsync();

    public async Task<IReadOnlyList<MenuItem>> GetPopularAsync(int count) =>
        await _dbSet.Include(m => m.Category)
                    .Include(m => m.OrderDetails)
                    .OrderByDescending(m => m.OrderDetails.Count)
                    .Take(count)
                    .ToListAsync();

    public async Task<IReadOnlyList<MenuItem>> GetByIdsAsync(List<int> ids) =>
        await _dbSet.Where(m => ids.Contains(m.Id)).ToListAsync();
}

public class UserRepository : GenericRepository<User>, IUserRepository
{
    public UserRepository(SmartDineDbContext context) : base(context) { }

    public async Task<User?> GetByEmailAsync(string email) =>
        await _dbSet.FirstOrDefaultAsync(u => u.Email == email);

    public async Task<bool> ExistsAsync(string email) =>
        await _dbSet.AnyAsync(u => u.Email == email);
}

public class CustomerRepository : GenericRepository<Customer>, ICustomerRepository
{
    public CustomerRepository(SmartDineDbContext context) : base(context) { }

    public async Task<Customer?> GetByEmailAsync(string email) =>
        await _dbSet.FirstOrDefaultAsync(c => c.Email == email);

    public async Task<Customer?> GetByPhoneAsync(string phone) =>
        await _dbSet.FirstOrDefaultAsync(c => c.Phone == phone);
}

public class TableRepository : GenericRepository<Table>, ITableRepository
{
    public TableRepository(SmartDineDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Table>> GetByStatusAsync(string status) =>
        await _dbSet.Where(t => t.Status == status).OrderBy(t => t.TableNumber).ToListAsync();

    public async Task<Table?> GetByTableNumberAsync(int tableNumber) =>
        await _dbSet.FirstOrDefaultAsync(t => t.TableNumber == tableNumber);
}

public class DiningSessionRepository : GenericRepository<DiningSession>, IDiningSessionRepository
{
    public DiningSessionRepository(SmartDineDbContext context) : base(context) { }

    public async Task<IReadOnlyList<DiningSession>> GetActiveSessionsAsync() =>
        await _dbSet.Include(d => d.Customer)
                    .Include(d => d.Table)
                    .Where(d => d.Status == "ACTIVE")
                    .ToListAsync();

    public async Task<DiningSession?> GetActiveByTableIdAsync(int tableId) =>
        await _dbSet.Include(d => d.Orders)
                    .FirstOrDefaultAsync(d => d.TableId == tableId && d.Status == "ACTIVE");
}

public class PaymentRepository : GenericRepository<Payment>, IPaymentRepository
{
    public PaymentRepository(SmartDineDbContext context) : base(context) { }

    public async Task<Payment?> GetByOrderIdAsync(int orderId) =>
        await _dbSet.FirstOrDefaultAsync(p => p.OrderId == orderId);

    public async Task<IReadOnlyList<Payment>> GetByDateRangeAsync(DateTime start, DateTime end) =>
        await _dbSet.Where(p => p.PaidAt >= start && p.PaidAt <= end)
                    .OrderByDescending(p => p.PaidAt)
                    .ToListAsync();
}

public class ReviewRepository : GenericRepository<Review>, IReviewRepository
{
    public ReviewRepository(SmartDineDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Review>> GetByMenuItemIdAsync(int menuItemId) =>
        await _dbSet.Include(r => r.Customer)
                    .Where(r => r.MenuItemId == menuItemId)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

    public async Task<IReadOnlyList<Review>> GetByCustomerIdAsync(int customerId) =>
        await _dbSet.Where(r => r.CustomerId == customerId)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

    public async Task<double> GetAverageRatingByMenuItemIdAsync(int menuItemId)
    {
        var reviews = await _dbSet.Where(r => r.MenuItemId == menuItemId).ToListAsync();
        return reviews.Count == 0 ? 0 : reviews.Average(r => r.Rating);
    }
}
