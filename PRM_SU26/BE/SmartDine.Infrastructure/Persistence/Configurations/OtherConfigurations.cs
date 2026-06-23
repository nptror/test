using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartDine.Domain.Entities;

namespace SmartDine.Infrastructure.Persistence.Configurations;

public class TableConfiguration : IEntityTypeConfiguration<Table>
{
    public void Configure(EntityTypeBuilder<Table> builder)
    {
        builder.ToTable("dining_tables");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.TableNumber).IsRequired();
        builder.Property(t => t.Capacity).IsRequired();
        builder.Property(t => t.QrCode).HasMaxLength(255);
        builder.Property(t => t.Status).HasMaxLength(20).HasDefaultValue("AVAILABLE");

        builder.HasIndex(t => t.TableNumber).IsUnique();
    }
}

public class DiningSessionConfiguration : IEntityTypeConfiguration<DiningSession>
{
    public void Configure(EntityTypeBuilder<DiningSession> builder)
    {
        builder.ToTable("dining_sessions");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.GuestName).HasMaxLength(100);
        builder.Property(d => d.GuestPhone).HasMaxLength(20);
        builder.Property(d => d.Status).HasMaxLength(20).HasDefaultValue("ACTIVE");
        builder.Property(d => d.TotalSpent).HasPrecision(12, 2);

        builder.HasOne(d => d.Customer)
               .WithMany(c => c.DiningSessions)
               .HasForeignKey(d => d.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.Table)
               .WithMany(t => t.DiningSessions)
               .HasForeignKey(d => d.TableId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderDetailConfiguration : IEntityTypeConfiguration<OrderDetail>
{
    public void Configure(EntityTypeBuilder<OrderDetail> builder)
    {
        builder.ToTable("order_details");
        builder.HasKey(od => od.Id);
        builder.Property(od => od.Quantity).IsRequired();
        builder.Property(od => od.UnitPrice).HasPrecision(12, 2).IsRequired();
        builder.Property(od => od.Notes).HasMaxLength(255);
        builder.Property(od => od.Status).HasMaxLength(20).IsRequired();

        builder.HasOne(od => od.Order)
               .WithMany(o => o.OrderDetails)
               .HasForeignKey(od => od.OrderId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(od => od.MenuItem)
               .WithMany(m => m.OrderDetails)
               .HasForeignKey(od => od.MenuItemId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(od => od.AssignedChef)
               .WithMany()
               .HasForeignKey(od => od.AssignedChefId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(od => od.CompletedBy)
               .WithMany()
               .HasForeignKey(od => od.CompletedById)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(od => od.OrderCombo)
               .WithMany(oc => oc.OrderDetails)
               .HasForeignKey(od => od.OrderComboId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Amount).HasPrecision(12, 2).IsRequired();
        builder.Property(p => p.PaymentMethod).HasMaxLength(50).IsRequired();
        builder.Property(p => p.PaymentStatus).HasMaxLength(20).HasDefaultValue("SUCCESS");

        builder.HasOne(p => p.Order)
               .WithMany(o => o.Payments)
               .HasForeignKey(p => p.OrderId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.ToTable("reviews");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Rating).IsRequired();
        builder.Property(r => r.Comment).HasColumnType("text");
        builder.Property(r => r.Status).HasMaxLength(20).HasDefaultValue("PENDING");

        builder.HasIndex(r => new { r.CustomerId, r.MenuItemId }).IsUnique();

        builder.HasOne(r => r.Customer)
               .WithMany(c => c.Reviews)
               .HasForeignKey(r => r.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.MenuItem)
               .WithMany(m => m.Reviews)
               .HasForeignKey(r => r.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("promotions");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).HasMaxLength(100);
        builder.Property(p => p.Description).HasColumnType("text");
        builder.Property(p => p.DiscountType).HasMaxLength(20).IsRequired();
        builder.Property(p => p.DiscountValue).HasPrecision(12, 2).IsRequired();
        builder.Property(p => p.IsActive).HasDefaultValue(true);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.RecipientType).HasMaxLength(20).IsRequired();
        builder.Property(n => n.NotificationType).HasMaxLength(50).IsRequired();
        builder.Property(n => n.Title).HasMaxLength(255).IsRequired();
        builder.Property(n => n.Message).HasColumnType("text").IsRequired();
        builder.Property(n => n.Data).HasColumnType("jsonb");
    }
}

public class CustomerActivityConfiguration : IEntityTypeConfiguration<CustomerActivity>
{
    public void Configure(EntityTypeBuilder<CustomerActivity> builder)
    {
        builder.ToTable("customer_activities");
        builder.HasKey(ca => ca.Id);
        builder.Property(ca => ca.ActivityType).HasMaxLength(50).IsRequired();
        builder.Property(ca => ca.Payload).HasColumnType("jsonb");

        builder.HasOne(ca => ca.Customer)
               .WithMany(c => c.Activities)
               .HasForeignKey(ca => ca.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ca => ca.Session)
               .WithMany()
               .HasForeignKey(ca => ca.SessionId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
    {
        builder.ToTable("loyalty_transactions");
        builder.HasKey(lt => lt.Id);
        builder.Property(lt => lt.Points).IsRequired();
        builder.Property(lt => lt.TransactionType).HasMaxLength(20).IsRequired();

        builder.HasOne(lt => lt.Customer)
               .WithMany(c => c.LoyaltyTransactions)
               .HasForeignKey(lt => lt.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(lt => lt.Order)
               .WithMany()
               .HasForeignKey(lt => lt.OrderId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.FullName).HasMaxLength(100);
        builder.Property(c => c.Phone).HasMaxLength(20);
        builder.Property(c => c.Email).HasMaxLength(100);
        builder.Property(c => c.PasswordHash).HasMaxLength(255);
        builder.Property(c => c.MembershipLevel).HasMaxLength(20).HasDefaultValue("BRONZE");
        builder.Property(c => c.TotalSpent).HasPrecision(12, 2).HasDefaultValue(0.00m);
        builder.Property(c => c.VisitCount).HasDefaultValue(0);

        builder.HasIndex(c => c.Phone).IsUnique();
        builder.HasIndex(c => c.Email).IsUnique();
    }
}

public class TableReservationConfiguration : IEntityTypeConfiguration<TableReservation>
{
    public void Configure(EntityTypeBuilder<TableReservation> builder)
    {
        builder.ToTable("table_reservations");
        builder.HasKey(tr => tr.Id);
        builder.Property(tr => tr.GuestName).HasMaxLength(100);
        builder.Property(tr => tr.GuestPhone).HasMaxLength(20);
        builder.Property(tr => tr.Status).HasMaxLength(20).IsRequired();
        builder.Property(tr => tr.Notes).HasMaxLength(255);

        builder.HasOne(tr => tr.Customer)
               .WithMany(c => c.Reservations)
               .HasForeignKey(tr => tr.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(tr => tr.Table)
               .WithMany(t => t.Reservations)
               .HasForeignKey(tr => tr.TableId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MenuItemPriceHistoryConfiguration : IEntityTypeConfiguration<MenuItemPriceHistory>
{
    public void Configure(EntityTypeBuilder<MenuItemPriceHistory> builder)
    {
        builder.ToTable("menu_item_price_history");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.OldPrice).HasPrecision(12, 2);
        builder.Property(h => h.NewPrice).HasPrecision(12, 2).IsRequired();
        builder.Property(h => h.Reason).HasMaxLength(255);

        builder.HasOne(h => h.MenuItem)
               .WithMany(m => m.PriceHistory)
               .HasForeignKey(h => h.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.ChangedBy)
               .WithMany()
               .HasForeignKey(h => h.ChangedById)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderDetailReturnConfiguration : IEntityTypeConfiguration<OrderDetailReturn>
{
    public void Configure(EntityTypeBuilder<OrderDetailReturn> builder)
    {
        builder.ToTable("order_detail_returns");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Reason).HasMaxLength(255);
        builder.Property(r => r.RefundAmount).HasPrecision(12, 2).IsRequired();

        builder.HasOne(r => r.OrderDetail)
               .WithMany(od => od.Returns)
               .HasForeignKey(r => r.OrderDetailId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ApprovedBy)
               .WithMany()
               .HasForeignKey(r => r.ApprovedById)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class BusinessContextLogConfiguration : IEntityTypeConfiguration<BusinessContextLog>
{
    public void Configure(EntityTypeBuilder<BusinessContextLog> builder)
    {
        builder.ToTable("business_context_logs");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.WeatherCondition).HasMaxLength(50);
        builder.Property(l => l.Temperature).HasPrecision(5, 2);
        builder.Property(l => l.HolidayName).HasMaxLength(100);
        builder.Property(l => l.LocalEvent).HasMaxLength(255);
        builder.Property(l => l.Notes).HasMaxLength(255);

        builder.HasIndex(l => l.ContextDate).IsUnique();
    }
}

public class CustomerStatisticsConfiguration : IEntityTypeConfiguration<CustomerStatistics>
{
    public void Configure(EntityTypeBuilder<CustomerStatistics> builder)
    {
        builder.ToTable("customer_statistics");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.TotalSpent).HasPrecision(12, 2).HasDefaultValue(0.00m);
        builder.Property(s => s.AverageOrderValue).HasPrecision(12, 2).HasDefaultValue(0.00m);
        builder.Property(s => s.FavoriteCategory).HasMaxLength(100);

        builder.HasOne(s => s.Customer)
               .WithOne(c => c.Statistics)
               .HasForeignKey<CustomerStatistics>(s => s.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class MenuItemStatisticsConfiguration : IEntityTypeConfiguration<MenuItemStatistics>
{
    public void Configure(EntityTypeBuilder<MenuItemStatistics> builder)
    {
        builder.ToTable("menu_item_statistics");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.TotalRevenue).HasPrecision(12, 2).HasDefaultValue(0.00m);
        builder.Property(s => s.AverageRating).HasPrecision(3, 2);

        builder.HasOne(s => s.MenuItem)
               .WithOne(m => m.Statistics)
               .HasForeignKey<MenuItemStatistics>(s => s.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ComboConfiguration : IEntityTypeConfiguration<Combo>
{
    public void Configure(EntityTypeBuilder<Combo> builder)
    {
        builder.ToTable("combos");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).HasMaxLength(100);
        builder.Property(c => c.Description).HasColumnType("text");
        builder.Property(c => c.ComboPrice).HasPrecision(12, 2).IsRequired();
        builder.Property(c => c.IsActive).HasDefaultValue(true);
    }
}

public class ComboItemConfiguration : IEntityTypeConfiguration<ComboItem>
{
    public void Configure(EntityTypeBuilder<ComboItem> builder)
    {
        builder.ToTable("combo_items");
        builder.HasKey(ci => ci.Id);

        builder.HasOne(ci => ci.Combo)
               .WithMany(c => c.ComboItems)
               .HasForeignKey(ci => ci.ComboId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ci => ci.MenuItem)
               .WithMany(m => m.ComboItems)
               .HasForeignKey(ci => ci.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PromotionMembershipConfiguration : IEntityTypeConfiguration<PromotionMembership>
{
    public void Configure(EntityTypeBuilder<PromotionMembership> builder)
    {
        builder.ToTable("promotion_memberships");
        builder.HasKey(pm => pm.Id);
        builder.Property(pm => pm.MembershipLevel).HasMaxLength(20).IsRequired();

        builder.HasOne(pm => pm.Promotion)
               .WithMany(p => p.PromotionMemberships)
               .HasForeignKey(pm => pm.PromotionId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrderPromotionConfiguration : IEntityTypeConfiguration<OrderPromotion>
{
    public void Configure(EntityTypeBuilder<OrderPromotion> builder)
    {
        builder.ToTable("order_promotions");
        builder.HasKey(op => op.Id);
        builder.Property(op => op.DiscountAmount).HasPrecision(12, 2).IsRequired();

        builder.HasOne(op => op.Order)
               .WithMany(o => o.OrderPromotions)
               .HasForeignKey(op => op.OrderId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(op => op.Promotion)
               .WithMany(p => p.OrderPromotions)
               .HasForeignKey(op => op.PromotionId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PromotionMenuItemConfiguration : IEntityTypeConfiguration<PromotionMenuItem>
{
    public void Configure(EntityTypeBuilder<PromotionMenuItem> builder)
    {
        builder.ToTable("promotion_menu_items");
        builder.HasKey(pmi => pmi.Id);

        builder.HasOne(pmi => pmi.Promotion)
               .WithMany(p => p.PromotionMenuItems)
               .HasForeignKey(pmi => pmi.PromotionId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(pmi => pmi.MenuItem)
               .WithMany(m => m.PromotionMenuItems)
               .HasForeignKey(pmi => pmi.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class CustomerCouponConfiguration : IEntityTypeConfiguration<CustomerCoupon>
{
    public void Configure(EntityTypeBuilder<CustomerCoupon> builder)
    {
        builder.ToTable("customer_coupons");
        builder.HasKey(cc => cc.Id);
        builder.Property(cc => cc.IsUsed).HasDefaultValue(false);

        builder.HasOne(cc => cc.Customer)
               .WithMany(c => c.Coupons)
               .HasForeignKey(cc => cc.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cc => cc.Promotion)
               .WithMany(p => p.CustomerCoupons)
               .HasForeignKey(cc => cc.PromotionId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class RobotConfiguration : IEntityTypeConfiguration<Robot>
{
    public void Configure(EntityTypeBuilder<Robot> builder)
    {
        builder.ToTable("robots");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.RobotCode).HasMaxLength(50).IsRequired();
        builder.Property(r => r.RobotName).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Status).HasMaxLength(20).IsRequired();
        builder.Property(r => r.CurrentLocation).HasMaxLength(100);

        builder.HasIndex(r => r.RobotCode).IsUnique();
    }
}

public class RobotDeliveryBatchConfiguration : IEntityTypeConfiguration<RobotDeliveryBatch>
{
    public void Configure(EntityTypeBuilder<RobotDeliveryBatch> builder)
    {
        builder.ToTable("robot_delivery_batches");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Status).HasMaxLength(20).IsRequired();

        builder.HasOne(b => b.Robot)
               .WithMany(r => r.DeliveryBatches)
               .HasForeignKey(b => b.RobotId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(b => b.Table)
               .WithMany(t => t.DeliveryBatches)
               .HasForeignKey(b => b.TableId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RobotDeliveryItemConfiguration : IEntityTypeConfiguration<RobotDeliveryItem>
{
    public void Configure(EntityTypeBuilder<RobotDeliveryItem> builder)
    {
        builder.ToTable("robot_delivery_items");
        builder.HasKey(ri => ri.Id);

        builder.HasOne(ri => ri.Batch)
               .WithMany(b => b.DeliveryItems)
               .HasForeignKey(ri => ri.BatchId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ri => ri.OrderDetail)
               .WithMany(od => od.RobotDeliveryItems)
               .HasForeignKey(ri => ri.OrderDetailId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrderComboConfiguration : IEntityTypeConfiguration<OrderCombo>
{
    public void Configure(EntityTypeBuilder<OrderCombo> builder)
    {
        builder.ToTable("order_combos");
        builder.HasKey(oc => oc.Id);
        builder.Property(oc => oc.ComboPrice).HasPrecision(12, 2).IsRequired();

        builder.HasOne(oc => oc.Order)
               .WithMany(o => o.OrderCombos)
               .HasForeignKey(oc => oc.OrderId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(oc => oc.Combo)
               .WithMany(c => c.OrderCombos)
               .HasForeignKey(oc => oc.ComboId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

public class SessionParticipantConfiguration : IEntityTypeConfiguration<SessionParticipant>
{
    public void Configure(EntityTypeBuilder<SessionParticipant> builder)
    {
        builder.ToTable("session_participants");
        builder.HasKey(sp => sp.Id);

        builder.HasOne(sp => sp.Session)
               .WithMany(s => s.Participants)
               .HasForeignKey(sp => sp.SessionId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sp => sp.Customer)
               .WithMany(c => c.SessionParticipants)
               .HasForeignKey(sp => sp.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public class RecommendationLogConfiguration : IEntityTypeConfiguration<RecommendationLog>
{
    public void Configure(EntityTypeBuilder<RecommendationLog> builder)
    {
        builder.ToTable("recommendation_logs");
        builder.HasKey(rl => rl.Id);
        builder.Property(rl => rl.RecommendationReason).HasMaxLength(255);
        builder.Property(rl => rl.Clicked).HasDefaultValue(false);
        builder.Property(rl => rl.Ordered).HasDefaultValue(false);

        builder.HasOne(rl => rl.Customer)
               .WithMany(c => c.RecommendationLogs)
               .HasForeignKey(rl => rl.CustomerId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(rl => rl.MenuItem)
               .WithMany(m => m.RecommendationLogs)
               .HasForeignKey(rl => rl.MenuItemId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
