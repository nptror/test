namespace SmartDine.Application.DTOs.Tables;

public class TableResponse
{
    public int Id { get; set; }
    public int TableNumber { get; set; }
    public int Capacity { get; set; }
    public string Status { get; set; } = "AVAILABLE";
    public string? QrCode { get; set; }
}

public class UpdateTableStatusRequest
{
    public string Status { get; set; } = "AVAILABLE";
}

public class CreateTableRequest
{
    public int TableNumber { get; set; }
    public int Capacity { get; set; } = 4;
}
