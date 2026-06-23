using SmartDine.Domain.Entities;

namespace SmartDine.Domain.Interfaces;

public interface IReviewRepository : IRepository<Review>
{
    Task<IReadOnlyList<Review>> GetByMenuItemIdAsync(int menuItemId);
    Task<IReadOnlyList<Review>> GetByCustomerIdAsync(int customerId);
    Task<double> GetAverageRatingByMenuItemIdAsync(int menuItemId);
}
