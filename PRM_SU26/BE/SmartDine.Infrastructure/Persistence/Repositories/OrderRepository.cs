using Microsoft.EntityFrameworkCore;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartDine.Infrastructure.Persistence.Repositories;

public class OrderRepository : GenericRepository<Order>, IOrderRepository
{
    public OrderRepository(SmartDineDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Order>> GetByCustomerIdAsync(int customerId, int page, int pageSize) =>
        await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                    .Include(o => o.Session)
                    .Where(o => o.Session.CustomerId == customerId)
                    .OrderByDescending(o => o.CreatedAt)
                    .Skip((page - 1) * pageSize).Take(pageSize)
                    .ToListAsync();

    public async Task<IReadOnlyList<Order>> GetByStatusAsync(string status) =>
        await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                    .Include(o => o.Session).ThenInclude(s => s.Table)
                    .Where(o => o.Status == status)
                    .OrderBy(o => o.CreatedAt)
                    .ToListAsync();

    public async Task<IReadOnlyList<Order>> GetActiveOrdersAsync() =>
        await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                    .Include(o => o.Session).ThenInclude(s => s.Table)
                    .Include(o => o.Session).ThenInclude(s => s.Customer)
                    .Where(o => o.Status != "COMPLETED" && o.Status != "CANCELLED")
                    .OrderBy(o => o.CreatedAt)
                    .ToListAsync();

    public async Task<IReadOnlyList<Order>> GetTodayOrdersAsync()
    {
        var today = DateTime.UtcNow.Date;
        return await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                           .Where(o => o.CreatedAt >= today)
                           .OrderByDescending(o => o.CreatedAt)
                           .ToListAsync();
    }

    public async Task<IReadOnlyList<Order>> GetByDiningSessionIdAsync(int sessionId) =>
        await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                    .Where(o => o.SessionId == sessionId)
                    .OrderBy(o => o.CreatedAt)
                    .ToListAsync();

    public override async Task<Order?> GetByIdAsync(int id) =>
        await _dbSet.Include(o => o.OrderDetails).ThenInclude(d => d.MenuItem)
                    .Include(o => o.Session).ThenInclude(s => s.Table)
                    .Include(o => o.Session).ThenInclude(s => s.Customer)
                    .FirstOrDefaultAsync(o => o.Id == id);
}
