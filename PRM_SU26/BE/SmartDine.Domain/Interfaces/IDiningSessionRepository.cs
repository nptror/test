using SmartDine.Domain.Entities;

namespace SmartDine.Domain.Interfaces;

public interface IDiningSessionRepository : IRepository<DiningSession>
{
    Task<IReadOnlyList<DiningSession>> GetActiveSessionsAsync();
    Task<DiningSession?> GetActiveByTableIdAsync(int tableId);
}
