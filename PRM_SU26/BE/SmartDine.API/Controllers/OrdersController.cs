using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartDine.Application.DTOs.Common;
using SmartDine.Application.DTOs.Orders;
using SmartDine.Application.Services;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SmartDine.API.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly OrderService _orderService;

    public OrdersController(OrderService orderService)
    {
        _orderService = orderService;
    }

    /// <summary>POST /api/v1/orders — Đặt món mới</summary>
    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderRequest request)
    {
        // Lấy customerId từ JWT claims (được map vào NameIdentifier khi login/register)
        var customerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _orderService.PlaceOrderAsync(customerId, request);
        return Created("", ApiResponse<OrderResponse>.Ok(result, "Đặt món thành công"));
    }

    /// <summary>GET /api/v1/orders/{id} — Lấy chi tiết đơn hàng</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _orderService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<object>.Fail("Không tìm thấy đơn hàng"));
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>GET /api/v1/orders/active — Đơn hàng đang hoạt động (cho kitchen/staff)</summary>
    [HttpGet("active")]
    [Authorize(Roles = "STAFF,CHEF,MANAGER")]
    public async Task<IActionResult> GetActiveOrders()
    {
        var result = await _orderService.GetActiveOrdersAsync();
        return Ok(ApiResponse<List<OrderResponse>>.Ok(result));
    }

    /// <summary>GET /api/v1/orders/today — Tất cả đơn hôm nay (cho manager)</summary>
    [HttpGet("today")]
    [Authorize(Roles = "MANAGER")]
    public async Task<IActionResult> GetTodayOrders()
    {
        var result = await _orderService.GetTodayOrdersAsync();
        return Ok(ApiResponse<List<OrderResponse>>.Ok(result));
    }

    /// <summary>PATCH /api/v1/orders/{id}/status — Cập nhật trạng thái đơn hàng</summary>
    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "STAFF,CHEF,MANAGER")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateOrderStatusRequest request)
    {
        var result = await _orderService.UpdateStatusAsync(id, request.Status);
        return Ok(ApiResponse<OrderResponse>.Ok(result, "Cập nhật trạng thái thành công"));
    }

    /// <summary>GET /api/v1/orders/my — Lịch sử đơn hàng của customer</summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyOrders([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var customerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _orderService.GetByCustomerIdAsync(customerId, page, pageSize);
        return Ok(ApiResponse<List<OrderResponse>>.Ok(result));
    }
}
