const BASE_URL = '/api/v1';

function getHeaders(telegramId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-telegram-id': telegramId,
  };
}

export const api = {
  // Auth
  authTelegram: async (telegramId: string, firstName?: string, lastName?: string) => {
    const res = await fetch(`${BASE_URL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, firstName, lastName }),
    });
    return res.json();
  },

  // Catalog
  getCategories: async () => {
    const res = await fetch(`${BASE_URL}/catalog/categories`);
    return res.json();
  },

  getProducts: async (categoryId?: string) => {
    const url = categoryId
      ? `${BASE_URL}/catalog/products?categoryId=${categoryId}`
      : `${BASE_URL}/catalog/products`;
    const res = await fetch(url);
    return res.json();
  },

  // Cart
  getCart: async (telegramId: string) => {
    const res = await fetch(`${BASE_URL}/cart`, {
      headers: getHeaders(telegramId),
    });
    return res.json();
  },

  addToCart: async (telegramId: string, productVariantId: string, quantity: number = 1) => {
    const res = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: getHeaders(telegramId),
      body: JSON.stringify({ productVariantId, quantity }),
    });
    return res.json();
  },

  updateCartItem: async (telegramId: string, itemId: string, quantity: number) => {
    const res = await fetch(`${BASE_URL}/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: getHeaders(telegramId),
      body: JSON.stringify({ quantity }),
    });
    return res.json();
  },

  removeCartItem: async (telegramId: string, itemId: string) => {
    const res = await fetch(`${BASE_URL}/cart/items/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders(telegramId),
    });
    return res.json();
  },

  clearCart: async (telegramId: string) => {
    const res = await fetch(`${BASE_URL}/cart`, {
      method: 'DELETE',
      headers: getHeaders(telegramId),
    });
    return res.json();
  },

  // Orders
  createOrder: async (telegramId: string, data: {
    deliveryType: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    comment?: string;
  }) => {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: getHeaders(telegramId),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  confirmPayment: async (telegramId: string, orderId: string, data: {
    paymentType: string;
    paymentScreenshot?: string;
  }) => {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/payment`, {
      method: 'POST',
      headers: getHeaders(telegramId),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Address search (Nominatim)
  searchAddress: async (query: string): Promise<Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>> => {
    if (!query || query.length < 3) return [];
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      countrycodes: 'uz',
      addressdetails: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'ru,uz' },
    });
    return res.json();
  },
};
