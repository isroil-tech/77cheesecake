export interface ProductVariant {
  id: string;
  productId: string;
  nameUz: string;
  nameRu: string;
  unitType: 'whole' | 'slice' | 'piece';
  price: number;
  piecesPerUnit: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  categoryId: string;
  nameUz: string;
  nameRu: string;
  descriptionUz: string | null;
  descriptionRu: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  variants: ProductVariant[];
  category: Category;
}

export interface Category {
  id: string;
  nameUz: string;
  nameRu: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  productVariant: ProductVariant & { product: Product };
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
}

export interface User {
  id: string;
  telegramId: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            language_code?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          isVisible: boolean;
          setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
          isVisible: boolean;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}
