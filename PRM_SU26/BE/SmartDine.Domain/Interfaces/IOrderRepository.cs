using SmartDine.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SmartDine.Domain.Interfaces;

public interface IOrderRepository : IRepository<Order>
{
    Task<IReadOnlyList<Order>> GetByCustomerIdAsync(int customerId, int page, int pageSize);
    Task<IReadOnlyList<Order>> GetByStatusAsync(string status);
    Task<IReadOnlyList<Order>> GetActiveOrdersAsync();
    Task<IReadOnlyList<Order>> GetTodayOrdersAsync();
    Task<IReadOnlyList<Order>> GetByDiningSessionIdAsync(int sessionId);
}
