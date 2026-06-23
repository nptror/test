using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartDine.Domain.Entities;

namespace SmartDine.Infrastructure.Persistence.Configurations;

public class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("menu_items");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Name).HasMaxLength(150).IsRequired();
        builder.Property(m => m.Description).HasColumnType("text");
        builder.Property(m => m.Price).HasPrecision(12, 2);
        builder.Property(m => m.ImageUrl).HasMaxLength(500);

        builder.HasIndex(m => m.CategoryId);
        builder.HasIndex(m => m.IsAvailable);

        builder.HasOne(m => m.Category)
               .WithMany(c => c.MenuItems)
               .HasForeignKey(m => m.CategoryId);
    }
}

public class MenuCategoryConfiguration : IEntityTypeConfiguration<MenuCategory>
{
    public void Configure(EntityTypeBuilder<MenuCategory> builder)
    {
        builder.ToTable("categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Description).HasColumnType("text");
    }
}
