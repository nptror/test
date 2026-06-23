using Microsoft.EntityFrameworkCore;
using SmartDine.Domain.Entities;

namespace SmartDine.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext cho SmartDine — kết nối PostgreSQL.
/// </summary>
public class SmartDineDbContext : DbContext
{
    public SmartDineDbContext(DbContextOptions<SmartDineDbContext> options)
        : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderDetail> OrderDetails => Set<OrderDetail>();
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<DiningSession> DiningSessions => Set<DiningSession>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<CustomerActivity> CustomerActivities => Set<CustomerActivity>();
    public DbSet<TableReservation> TableReservations => Set<TableReservation>();
    public DbSet<MenuItemPriceHistory> MenuItemPriceHistories => Set<MenuItemPriceHistory>();
    public DbSet<OrderDetailReturn> OrderDetailReturns => Set<OrderDetailReturn>();
    public DbSet<BusinessContextLog> BusinessContextLogs => Set<BusinessContextLog>();
    public DbSet<CustomerStatistics> CustomerStatistics => Set<CustomerStatistics>();
    public DbSet<MenuItemStatistics> MenuItemStatistics => Set<MenuItemStatistics>();
    public DbSet<Combo> Combos => Set<Combo>();
    public DbSet<ComboItem> ComboItems => Set<ComboItem>();
    public DbSet<PromotionMembership> PromotionMemberships => Set<PromotionMembership>();
    public DbSet<OrderPromotion> OrderPromotions => Set<OrderPromotion>();
    public DbSet<PromotionMenuItem> PromotionMenuItems => Set<PromotionMenuItem>();
    public DbSet<CustomerCoupon> CustomerCoupons => Set<CustomerCoupon>();
    public DbSet<Robot> Robots => Set<Robot>();
    public DbSet<RobotDeliveryBatch> RobotDeliveryBatches => Set<RobotDeliveryBatch>();
    public DbSet<RobotDeliveryItem> RobotDeliveryItems => Set<RobotDeliveryItem>();
    public DbSet<OrderCombo> OrderCombos => Set<OrderCombo>();
    public DbSet<SessionParticipant> SessionParticipants => Set<SessionParticipant>();
    public DbSet<RecommendationLog> RecommendationLogs => Set<RecommendationLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply tất cả Fluent API configurations từ assembly này
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SmartDineDbContext).Assembly);

        // Global query filter cho soft delete cho tất cả các thực thể kế thừa BaseEntity
        modelBuilder.Entity<User>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Customer>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<MenuItem>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<MenuCategory>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Order>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<OrderDetail>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Table>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<DiningSession>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Payment>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Review>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<LoyaltyTransaction>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Promotion>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Notification>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CustomerActivity>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<TableReservation>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<MenuItemPriceHistory>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<OrderDetailReturn>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<BusinessContextLog>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CustomerStatistics>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<MenuItemStatistics>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Combo>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<ComboItem>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<PromotionMembership>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<OrderPromotion>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<PromotionMenuItem>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CustomerCoupon>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Robot>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<RobotDeliveryBatch>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<RobotDeliveryItem>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<OrderCombo>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<SessionParticipant>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<RecommendationLog>().HasQueryFilter(e => !e.IsDeleted);
    }

    /// <summary>
    /// Tự động set CreatedAt/UpdatedAt khi save.
    /// </summary>
    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    break;
            }
        }
        return base.SaveChangesAsync(ct);
    }
}
