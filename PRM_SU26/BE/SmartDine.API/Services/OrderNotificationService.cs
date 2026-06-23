using Microsoft.AspNetCore.SignalR;
using SmartDine.API.Hubs;
using SmartDine.Domain.Interfaces;

namespace SmartDine.API.Services;

/// <summary>
/// Thực thi IOrderNotificationService gửi tin nhắn qua SignalR Hub.
/// </summary>
public class OrderNotificationService : IOrderNotificationService
{
    private readonly IHubContext<OrderHub> _hubContext;

    public OrderNotificationService(IHubContext<OrderHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyNewOrderAsync(int orderId, int tableNumber, decimal totalAmount)
    {
        // Gửi thông báo đến nhóm "KitchenGroup" cho bếp và nhân viên phục vụ biết
        await _hubContext.Clients.Group("KitchenGroup").SendAsync("ReceiveNewOrder", new
        {
            OrderId = orderId,
            TableNumber = tableNumber,
            TotalAmount = totalAmount,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task NotifyOrderStatusChangedAsync(int orderId, int tableId, string status)
    {
        // Gửi thông báo đến nhóm khách hàng đang ngồi tại bàn "table_{tableId}"
        await _hubContext.Clients.Group($"table_{tableId}").SendAsync("ReceiveOrderStatusUpdate", new
        {
            OrderId = orderId,
            TableId = tableId,
            Status = status,
            Timestamp = DateTime.UtcNow
        });
    }
}
