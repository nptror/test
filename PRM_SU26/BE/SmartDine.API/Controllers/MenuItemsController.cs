using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartDine.Application.DTOs.Common;
using SmartDine.Application.DTOs.Menu;
using SmartDine.Application.Services;

namespace SmartDine.API.Controllers;

[ApiController]
[Route("api/v1/menu-items")]
public class MenuItemsController : ControllerBase
{
    private readonly MenuService _menuService;

    public MenuItemsController(MenuService menuService)
    {
        _menuService = menuService;
    }

    /// <summary>GET /api/v1/menu-items — Danh sách thực đơn (public)</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
    {
        var result = string.IsNullOrEmpty(search)
            ? await _menuService.GetAllAsync()
            : await _menuService.SearchAsync(search);
        return Ok(ApiResponse<List<MenuItemResponse>>.Ok(result));
    }

    /// <summary>GET /api/v1/menu-items/{id} — Chi tiết món ăn (public)</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _menuService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<object>.Fail("Không tìm thấy món ăn"));
        return Ok(ApiResponse<MenuItemResponse>.Ok(result));
    }

    /// <summary>GET /api/v1/menu-items/popular — Top món phổ biến (public)</summary>
    [HttpGet("popular")]
    public async Task<IActionResult> GetPopular([FromQuery] int count = 10)
    {
        var result = await _menuService.GetPopularAsync(count);
        return Ok(ApiResponse<List<MenuItemResponse>>.Ok(result));
    }

    /// <summary>POST /api/v1/menu-items — Tạo món mới (Manager only)</summary>
    [HttpPost]
    [Authorize(Roles = "MANAGER")]
    public async Task<IActionResult> Create([FromBody] CreateMenuItemRequest request)
    {
        var result = await _menuService.CreateAsync(request);
        return Created("", ApiResponse<MenuItemResponse>.Ok(result, "Tạo món thành công"));
    }

    /// <summary>PUT /api/v1/menu-items/{id} — Cập nhật món (Manager only)</summary>
    [HttpPut("{id:int}")]
    [Authorize(Roles = "MANAGER")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMenuItemRequest request)
    {
        var result = await _menuService.UpdateAsync(id, request);
        return Ok(ApiResponse<MenuItemResponse>.Ok(result, "Cập nhật thành công"));
    }

    /// <summary>DELETE /api/v1/menu-items/{id} — Xóa món (Manager only)</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MANAGER")]
    public async Task<IActionResult> Delete(int id)
    {
        await _menuService.DeleteAsync(id);
        return NoContent();
    }

    /// <summary>PATCH /api/v1/menu-items/{id}/availability — Toggle trạng thái</summary>
    [HttpPatch("{id:int}/availability")]
    [Authorize(Roles = "MANAGER,CHEF")]
    public async Task<IActionResult> ToggleAvailability(int id)
    {
        var result = await _menuService.ToggleAvailabilityAsync(id);
        return Ok(ApiResponse<MenuItemResponse>.Ok(result));
    }
}
