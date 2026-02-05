export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface Order {
  id: string;
  customerId: number;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface CreateOrderRequest {
  customerId: number;
  items: {
    productId: number;
    quantity: number;
  }[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}
