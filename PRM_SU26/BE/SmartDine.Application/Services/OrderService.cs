using SmartDine.Application.DTOs.Orders;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Exceptions;
using SmartDine.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartDine.Application.Services;

/// <summary>
/// Service xử lý nghiệp vụ đặt món — tạo đơn, cập nhật status, lấy danh sách.
/// </summary>
public class OrderService
{
    private readonly IUnitOfWork _uow;
    private readonly IOrderNotificationService _notificationService;

    public OrderService(IUnitOfWork uow, IOrderNotificationService notificationService)
    {
        _uow = uow;
        _notificationService = notificationService;
    }

    public async Task<OrderResponse> PlaceOrderAsync(int customerId, PlaceOrderRequest request)
    {
        var customer = await _uow.Customers.GetByIdAsync(customerId);
        if (customer == null)
            throw new BusinessRuleViolationException("Không tìm thấy thông tin khách hàng.");

        var session = await _uow.DiningSessions.GetByIdAsync(request.DiningSessionId)
            ?? throw new EntityNotFoundException("Dining Session", request.DiningSessionId);

        if (session.Status != "ACTIVE")
            throw new BusinessRuleViolationException("Dining Session này đã đóng.");

        // Validate menu items exist
        var menuItemIds = request.Items.Select(i => i.MenuItemId).ToList();
        var menuItems = await _uow.MenuItems.GetByIdsAsync(menuItemIds);

        if (menuItems.Count != menuItemIds.Count)
            throw new BusinessRuleViolationException("Một hoặc nhiều món không tồn tại trong menu.");

        var unavailable = menuItems.Where(m => !m.IsAvailable).Select(m => m.Name).ToList();
        if (unavailable.Any())
            throw new BusinessRuleViolationException($"Các món sau đang hết: {string.Join(", ", unavailable)}");

        // Create order
        var order = new Order
        {
            SessionId = session.Id,
            Status = "PENDING"
        };

        // Create order items
        foreach (var itemRequest in request.Items)
        {
            var menuItem = menuItems.First(m => m.Id == itemRequest.MenuItemId);
            order.OrderDetails.Add(new OrderDetail
            {
                MenuItemId = menuItem.Id,
                Quantity = itemRequest.Quantity,
                UnitPrice = menuItem.Price,
                Notes = itemRequest.Notes,
                Status = "WAITING"
            });
        }

        order.CalculateTotal();
        await _uow.Orders.AddAsync(order);
        await _uow.SaveChangesAsync();

        // Gửi thông báo thời gian thực đến nhà bếp
        var table = await _uow.Tables.GetByIdAsync(session.TableId);
        await _notificationService.NotifyNewOrderAsync(order.Id, table?.TableNumber ?? 0, order.FinalAmount);

        // Nạp đầy đủ thông tin để map response
        order.Session = session;
        order.Session.Table = table!;
        order.Session.Customer = customer;

        return MapToResponse(order, menuItems);
    }

    public async Task<OrderResponse> UpdateStatusAsync(int orderId, string newStatus)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId)
            ?? throw new EntityNotFoundException("Order", orderId);

        order.UpdateStatus(newStatus); // Domain business rule validation
        await _uow.SaveChangesAsync();

        // Gửi thông báo thời gian thực đến khách hàng tại bàn ăn
        await _notificationService.NotifyOrderStatusChangedAsync(order.Id, order.Session.TableId, newStatus);

        var menuItems = await _uow.MenuItems.GetByIdsAsync(
            order.OrderDetails.Select(i => i.MenuItemId).ToList());
        return MapToResponse(order, menuItems);
    }

    public async Task<OrderResponse?> GetByIdAsync(int orderId)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null) return null;

        var menuItems = await _uow.MenuItems.GetByIdsAsync(
            order.OrderDetails.Select(i => i.MenuItemId).ToList());
        return MapToResponse(order, menuItems);
    }

    public async Task<List<OrderResponse>> GetActiveOrdersAsync()
    {
        var orders = await _uow.Orders.GetActiveOrdersAsync();
        return orders.Select(o => MapToResponse(o,
            o.OrderDetails.Select(i => i.MenuItem).Where(m => m != null).ToList()!))
            .ToList();
    }

    public async Task<List<OrderResponse>> GetTodayOrdersAsync()
    {
        var orders = await _uow.Orders.GetTodayOrdersAsync();
        return orders.Select(o => MapToResponse(o,
            o.OrderDetails.Select(i => i.MenuItem).Where(m => m != null).ToList()!))
            .ToList();
    }

    public async Task<List<OrderResponse>> GetByCustomerIdAsync(int customerId, int page = 1, int pageSize = 20)
    {
        var customer = await _uow.Customers.GetByIdAsync(customerId);
        if (customer == null) return new List<OrderResponse>();

        var orders = await _uow.Orders.GetByCustomerIdAsync(customer.Id, page, pageSize);
        return orders.Select(o => MapToResponse(o,
            o.OrderDetails.Select(i => i.MenuItem).Where(m => m != null).ToList()!))
            .ToList();
    }

    private static OrderResponse MapToResponse(Order order, IReadOnlyList<MenuItem> menuItems)
    {
        return new OrderResponse
        {
            Id = order.Id,
            CustomerId = order.Session?.CustomerId,
            CustomerName = order.Session?.Customer?.FullName ?? order.Session?.GuestName,
            TableNumber = order.Session?.Table?.TableNumber ?? 0,
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            FinalAmount = order.FinalAmount,
            Status = order.Status,
            CreatedAt = order.CreatedAt,
            Items = order.OrderDetails.Select(i =>
            {
                var menu = menuItems.FirstOrDefault(m => m.Id == i.MenuItemId);
                return new OrderDetailResponse
                {
                    Id = i.Id,
                    MenuItemId = i.MenuItemId,
                    Name = menu?.Name ?? "Unknown",
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    Notes = i.Notes,
                    Status = i.Status
                };
            }).ToList()
        };
    }
}
