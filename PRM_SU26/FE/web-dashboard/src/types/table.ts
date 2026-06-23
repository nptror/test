export type TableStatus = 'AVAILABLE' | 'OCCUPIED';

export interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: TableStatus;
  qrCode?: string;
  // Simulated properties for UI alignment with screenshot
  zone?: string; 
}
