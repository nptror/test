using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartDine.Application.DTOs.Common;
using SmartDine.Application.DTOs.Tables;
using SmartDine.Application.Services;

namespace SmartDine.API.Controllers;

[ApiController]
[Route("api/v1/tables")]
[Authorize]
public class TablesController : ControllerBase
{
    private readonly TableService _tableService;

    public TablesController(TableService tableService)
    {
        _tableService = tableService;
    }

    /// <summary>GET /api/v1/tables — Danh sách tất cả bàn</summary>
    [HttpGet]
    [Authorize(Roles = "STAFF,MANAGER")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _tableService.GetAllAsync();
        return Ok(ApiResponse<List<TableResponse>>.Ok(result));
    }

    /// <summary>GET /api/v1/tables/{id} — Chi tiết bàn</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _tableService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<object>.Fail("Không tìm thấy bàn"));
        return Ok(ApiResponse<TableResponse>.Ok(result));
    }

    /// <summary>GET /api/v1/tables/available — Bàn trống</summary>
    [HttpGet("available")]
    [Authorize(Roles = "STAFF,MANAGER")]
    public async Task<IActionResult> GetAvailable()
    {
        var result = await _tableService.GetAvailableAsync();
        return Ok(ApiResponse<List<TableResponse>>.Ok(result));
    }

    /// <summary>POST /api/v1/tables — Thêm bàn mới (Manager only)</summary>
    [HttpPost]
    [Authorize(Roles = "MANAGER")]
    public async Task<IActionResult> Create([FromBody] CreateTableRequest request)
    {
        var result = await _tableService.CreateAsync(request);
        return Created("", ApiResponse<TableResponse>.Ok(result, "Thêm bàn thành công"));
    }

    /// <summary>PATCH /api/v1/tables/{id}/status — Cập nhật trạng thái bàn</summary>
    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "STAFF,MANAGER")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateTableStatusRequest request)
    {
        var result = await _tableService.UpdateStatusAsync(id, request.Status);
        return Ok(ApiResponse<TableResponse>.Ok(result, "Cập nhật trạng thái bàn thành công"));
    }
}
