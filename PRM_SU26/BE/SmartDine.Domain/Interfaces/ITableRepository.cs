using SmartDine.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SmartDine.Domain.Interfaces;

public interface ITableRepository : IRepository<Table>
{
    Task<IReadOnlyList<Table>> GetByStatusAsync(string status);
    Task<Table?> GetByTableNumberAsync(int tableNumber);
}
