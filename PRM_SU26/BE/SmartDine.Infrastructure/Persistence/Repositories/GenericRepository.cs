using Microsoft.EntityFrameworkCore;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Interfaces;

namespace SmartDine.Infrastructure.Persistence.Repositories;

/// <summary>
/// Generic repository implementation dùng EF Core.
/// </summary>
public class GenericRepository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly SmartDineDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public GenericRepository(SmartDineDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(int id) =>
        await _dbSet.FirstOrDefaultAsync(e => e.Id == id);

    public async Task<IReadOnlyList<T>> GetAllAsync() =>
        await _dbSet.OrderByDescending(e => e.CreatedAt).ToListAsync();

    public async Task<IReadOnlyList<T>> GetPagedAsync(int page, int pageSize) =>
        await _dbSet.OrderByDescending(e => e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

    public async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        return entity;
    }

    public Task UpdateAsync(T entity)
    {
        _context.Entry(entity).State = EntityState.Modified;
        return Task.CompletedTask;
    }

    public async Task DeleteAsync(int id)
    {
        var entity = await GetByIdAsync(id);
        if (entity != null)
        {
            entity.IsDeleted = true;
            entity.UpdatedAt = DateTime.UtcNow;
        }
    }

    public async Task<int> CountAsync() =>
        await _dbSet.CountAsync();
}
