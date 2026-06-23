export interface CreateMenuItemRequest {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: number;
}

export interface UpdateMenuItemRequest {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: number;
  isAvailable: boolean;
}

export interface MenuItemResponse {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: number;
  categoryName?: string;
  isAvailable: boolean;
  averageRating: number;
}

export interface MenuCategoryResponse {
  id: number;
  name: string;
  description?: string;
  itemCount: number;
}
