using SmartDine.Application.DTOs.Tables;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Enums;
using SmartDine.Domain.Exceptions;
using SmartDine.Domain.Interfaces;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SmartDine.Application.Services;

/// <summary>
/// Service xử lý quản lý bàn ăn.
/// </summary>
public class TableService
{
    private readonly IUnitOfWork _uow;

    public TableService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<List<TableResponse>> GetAllAsync()
    {
        var tables = await _uow.Tables.GetAllAsync();
        return tables.Select(MapToResponse).ToList();
    }

    public async Task<TableResponse?> GetByIdAsync(int id)
    {
        var table = await _uow.Tables.GetByIdAsync(id);
        return table == null ? null : MapToResponse(table);
    }

    public async Task<TableResponse> CreateAsync(CreateTableRequest request)
    {
        var table = new Table
        {
            TableNumber = request.TableNumber,
            Capacity = request.Capacity,
            Status = TableStatus.AVAILABLE.ToString(),
            QrCode = $"smartdine://table/{request.TableNumber}"
        };

        await _uow.Tables.AddAsync(table);
        await _uow.SaveChangesAsync();
        return MapToResponse(table);
    }

    public async Task<TableResponse> UpdateStatusAsync(int id, string status)
    {
        var table = await _uow.Tables.GetByIdAsync(id)
            ?? throw new EntityNotFoundException("Table", id);

        table.Status = status;
        await _uow.SaveChangesAsync();
        return MapToResponse(table);
    }

    public async Task<List<TableResponse>> GetAvailableAsync()
    {
        var tables = await _uow.Tables.GetByStatusAsync("AVAILABLE");
        return tables.Select(MapToResponse).ToList();
    }

    private static TableResponse MapToResponse(Table table) => new()
    {
        Id = table.Id,
        TableNumber = table.TableNumber,
        Capacity = table.Capacity,
        Status = table.Status,
        QrCode = table.QrCode
    };
}
