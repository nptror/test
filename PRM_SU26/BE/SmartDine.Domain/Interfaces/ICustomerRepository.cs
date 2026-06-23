using SmartDine.Domain.Entities;
using System.Threading.Tasks;

namespace SmartDine.Domain.Interfaces;

public interface ICustomerRepository : IRepository<Customer>
{
    Task<Customer?> GetByEmailAsync(string email);
    Task<Customer?> GetByPhoneAsync(string phone);
}
