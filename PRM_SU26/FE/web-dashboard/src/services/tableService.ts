import { apiClient } from './api/client';
import { Table, TableStatus } from '@/types/table';

export const tableService = {
  // Lấy danh sách tất cả bàn
  getAllTables: async (): Promise<Table[]> => {
    const response = await apiClient.get<any>('/tables');
    const list = response.data.data || response.data;
    
    // Map zones dynamically for UI matching the screenshot
    return (list as any[]).map((t: any) => ({
      ...t,
      zone: t.tableNumber > 10 ? 'VIP Room' : t.tableNumber > 5 ? 'Terrace' : 'Main Hall'
    })) as Table[];
  },

  // Thêm bàn mới
  createTable: async (tableNumber: number, capacity: number): Promise<Table> => {
    const response = await apiClient.post<any>('/tables', { tableNumber, capacity });
    const table = response.data.data || response.data;
    return {
      ...table,
      zone: table.tableNumber > 10 ? 'VIP Room' : table.tableNumber > 5 ? 'Terrace' : 'Main Hall'
    } as Table;
  },

  // Cập nhật trạng thái bàn (AVAILABLE / OCCUPIED)
  updateTableStatus: async (id: number, status: TableStatus): Promise<Table> => {
    const response = await apiClient.patch<any>(`/tables/${id}/status`, { status });
    const table = response.data.data || response.data;
    return {
      ...table,
      zone: table.tableNumber > 10 ? 'VIP Room' : table.tableNumber > 5 ? 'Terrace' : 'Main Hall'
    } as Table;
  }
};
