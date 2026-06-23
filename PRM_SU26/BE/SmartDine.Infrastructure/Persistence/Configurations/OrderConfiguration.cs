using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartDine.Domain.Entities;

namespace SmartDine.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.TotalAmount).HasPrecision(12, 2);
        builder.Property(o => o.DiscountAmount).HasPrecision(12, 2).HasDefaultValue(0.00m);
        builder.Property(o => o.FinalAmount).HasPrecision(12, 2);
        builder.Property(o => o.Status).HasMaxLength(20).HasDefaultValue("PENDING");

        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => o.SessionId);

        builder.HasOne(o => o.Session)
               .WithMany(s => s.Orders)
               .HasForeignKey(o => o.SessionId);
    }
}
