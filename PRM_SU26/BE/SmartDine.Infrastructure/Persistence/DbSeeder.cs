using SmartDine.Domain.Entities;
using SmartDine.Domain.Interfaces;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartDine.Infrastructure.Persistence;

/// <summary>
/// Seeder dữ liệu mẫu cho hệ thống SmartDine.
/// </summary>
public class DbSeeder
{
    private readonly SmartDineDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public DbSeeder(SmartDineDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task SeedAsync()
    {
        // 1. Seed Categories & Menu Items
        if (!_context.MenuCategories.Any())
        {
            var categories = new List<MenuCategory>
            {
                new()
                {
                    Name = "Khai vị",
                    Description = "Các món nhẹ bắt đầu bữa tiệc",
                    MenuItems = new List<MenuItem>
                    {
                        new() { Name = "Súp Hải Sản Tóc Tiên", Price = 45000, Description = "Súp hải sản ấm nóng thơm ngon" },
                        new() { Name = "Gỏi Cuốn Tôm Thịt", Price = 35000, Description = "Gỏi cuốn thanh mát chuẩn vị Việt" }
                    }
                },
                new()
                {
                    Name = "Món chính",
                    Description = "Các món đặc sắc của nhà hàng",
                    MenuItems = new List<MenuItem>
                    {
                        new() { Name = "Cơm Chiên Hải Sản", Price = 85000, Description = "Cơm chiên giòn rụm với tôm, mực tươi ngon" },
                        new() { Name = "Bò Lúc Lắc Khoai Tây Chiên", Price = 150000, Description = "Thịt bò mềm mọng nước cùng khoai tây chiên giòn" },
                        new() { Name = "Phở Bò Kobe Đặc Biệt", Price = 250000, Description = "Phở bò nước dùng hầm xương 24h cùng thịt bò Kobe thượng hạng" }
                    }
                },
                new()
                {
                    Name = "Đồ uống",
                    Description = "Nước giải khát, trà và bia",
                    MenuItems = new List<MenuItem>
                    {
                        new() { Name = "Trà Đào Cam Sả", Price = 30000, Description = "Trà đào thơm nức mũi giải nhiệt" },
                        new() { Name = "Nước Ép Dưa Hấu", Price = 35000, Description = "Nước ép dưa hấu nguyên chất 100%" },
                        new() { Name = "Heineken Silver Lon", Price = 25000, Description = "Bia lon Heineken mát lạnh" }
                    }
                },
                new()
                {
                    Name = "Tráng miệng",
                    Description = "Kem và chè tráng miệng ngọt ngào",
                    MenuItems = new List<MenuItem>
                    {
                        new() { Name = "Bánh Flan Caramel", Price = 20000, Description = "Bánh flan mềm mịn thơm ngậy" },
                        new() { Name = "Kem Dừa Trái Cây", Price = 40000, Description = "Kem dừa béo bùi kèm trái cây nhiệt đới" }
                    }
                }
            };

            await _context.MenuCategories.AddRangeAsync(categories);
            await _context.SaveChangesAsync();
        }

        // 2. Seed Tables
        if (!_context.Tables.Any())
        {
            var tables = new List<Table>
            {
                new() { TableNumber = 1, Capacity = 2, Status = "AVAILABLE", QrCode = "smartdine://table/1" },
                new() { TableNumber = 2, Capacity = 4, Status = "AVAILABLE", QrCode = "smartdine://table/2" },
                new() { TableNumber = 3, Capacity = 4, Status = "AVAILABLE", QrCode = "smartdine://table/3" },
                new() { TableNumber = 4, Capacity = 6, Status = "AVAILABLE", QrCode = "smartdine://table/4" },
                new() { TableNumber = 5, Capacity = 8, Status = "AVAILABLE", QrCode = "smartdine://table/5" }
            };

            await _context.Tables.AddRangeAsync(tables);
            await _context.SaveChangesAsync();
        }

        // 3. Seed Users (nhân viên nhà hàng)
        if (!_context.Users.Any())
        {
            var manager = new User
            {
                FullName = "SmartDine Admin",
                Email = "admin@smartdine.com",
                PasswordHash = _passwordHasher.HashPassword("Password123!"),
                Role = "MANAGER",
                IsActive = true
            };

            var staff = new User
            {
                FullName = "Nguyễn Văn Nhân Viên",
                Email = "staff@smartdine.com",
                PasswordHash = _passwordHasher.HashPassword("Password123!"),
                Role = "STAFF",
                IsActive = true
            };

            var chef = new User
            {
                FullName = "Trần Bếp Trưởng",
                Email = "chef@smartdine.com",
                PasswordHash = _passwordHasher.HashPassword("Password123!"),
                Role = "CHEF",
                IsActive = true
            };

            await _context.Users.AddRangeAsync(manager, staff, chef);
            await _context.SaveChangesAsync();
        }

        // 4. Seed Customers & active Session
        if (!_context.Customers.Any())
        {
            var defaultCustomer = new Customer
            {
                FullName = "Default Customer",
                Email = "customer@smartdine.com",
                Phone = "0900000001",
                PasswordHash = _passwordHasher.HashPassword("Password123!"),
                LoyaltyPoints = 100,
                MembershipLevel = "SILVER",
                TotalSpent = 500000.00m,
                VisitCount = 5
            };

            await _context.Customers.AddAsync(defaultCustomer);
            await _context.SaveChangesAsync();

            var firstTable = _context.Tables.First(t => t.TableNumber == 1);
            var session = new DiningSession
            {
                CustomerId = defaultCustomer.Id,
                TableId = firstTable.Id,
                GuestName = defaultCustomer.FullName,
                GuestPhone = defaultCustomer.Phone,
                Status = "ACTIVE",
                TotalSpent = 0.00m
            };

            await _context.DiningSessions.AddAsync(session);
            await _context.SaveChangesAsync();
        }
    }
}
