using SmartDine.Domain.Entities;

namespace SmartDine.Domain.Interfaces;

public interface IPaymentRepository : IRepository<Payment>
{
    Task<Payment?> GetByOrderIdAsync(int orderId);
    Task<IReadOnlyList<Payment>> GetByDateRangeAsync(DateTime start, DateTime end);
}
