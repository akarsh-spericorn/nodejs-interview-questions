export interface Warehouse {
  id: number;
  name: string;
  location: string;
  capacity: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  reorder_level: number;
}

export interface Stock {
  id: number;
  warehouse_id: number;
  product_id: number;
  quantity: number;
  last_updated: string;
}

export interface StockMovement {
  id: string;
  type: MovementType;
  from_warehouse: number | null;
  to_warehouse: number | null;
  product_id: number;
  quantity: number;
  reference: string;
  created_at: string;
}

export type MovementType = 'inbound' | 'outbound' | 'transfer' | 'adjustment';

export interface TransferRequest {
  fromWarehouseId: number;
  toWarehouseId: number;
  productId: number;
  quantity: number;
}

export interface StockAdjustmentRequest {
  warehouseId: number;
  productId: number;
  quantity: number;
  reason: string;
}
