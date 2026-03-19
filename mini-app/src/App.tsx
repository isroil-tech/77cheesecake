import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { t } from './i18n';
import type { Category, Product, Cart, CartItem, User } from './types';

type Page = 'catalog' | 'cart' | 'checkout' | 'success';

export default function App() {
  const [page, setPage] = useState<Page>('catalog');
  const [lang, setLang] = useState<string>('uz');
  const [telegramId, setTelegramId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [orderNumber, setOrderNumber] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTelegramId(user.id.toString());
      }
    }
  }, []);

  // Load user data and catalog
  useEffect(() => {
    if (!telegramId) return;

    const init = async () => {
      setLoading(true);
      try {
        // Auth and get user
        const authRes = await api.authTelegram(telegramId);
        if (authRes.user) {
          setLang(authRes.user.language || 'uz');
        }

        // Load catalog
        const [cats, prods, cartData] = await Promise.all([
          api.getCategories(),
          api.getProducts(),
          api.getCart(telegramId),
        ]);
        setCategories(cats);
        setProducts(prods);
        setCart(cartData);
      } catch (err) {
        console.error('Init error:', err);
      }
      setLoading(false);
    };

    init();
  }, [telegramId]);

  // Filtered products by category
  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter((p) => p.categoryId === activeCategory);

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const cartTotal = cart?.items?.reduce(
    (sum, item) => sum + Number(item.productVariant.price) * item.quantity, 0
  ) || 0;

  const refreshCart = useCallback(async () => {
    if (!telegramId) return;
    const data = await api.getCart(telegramId);
    setCart(data);
  }, [telegramId]);

  // Handlers
  const handleAddToCart = async (variantId: string) => {
    if (!telegramId) return;
    try {
      await api.addToCart(telegramId, variantId, 1);
      await refreshCart();
      const tg = window.Telegram?.WebApp;
      tg?.HapticFeedback?.impactOccurred('light');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateQty = async (itemId: string, qty: number) => {
    if (!telegramId) return;
    try {
      if (qty <= 0) {
        await api.removeCartItem(telegramId, itemId);
      } else {
        await api.updateCartItem(telegramId, itemId, qty);
      }
      await refreshCart();
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearCart = async () => {
    if (!telegramId) return;
    await api.clearCart(telegramId);
    await refreshCart();
  };

  const handlePlaceOrder = async () => {
    if (!telegramId || submitting) return;
    if (deliveryType === 'delivery' && !address.trim()) return;

    setSubmitting(true);
    try {
      const order = await api.createOrder(telegramId, {
        deliveryType,
        address: address.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setOrderNumber(order.orderNumber);
      setPage('success');
      setCart(null);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const getName = (item: { nameUz: string; nameRu: string }) =>
    lang === 'ru' ? item.nameRu : item.nameUz;

  const getDesc = (item: { descriptionUz?: string | null; descriptionRu?: string | null }) =>
    lang === 'ru' ? item.descriptionRu : item.descriptionUz;

  const formatPrice = (price: number) =>
    Number(price).toLocaleString('ru-RU');

  const getUnitLabel = (unitType: string) => t(lang, unitType);

  // --- RENDER ---

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        {t(lang, 'loading')}
      </div>
    );
  }

  // Success page
  if (page === 'success') {
    return (
      <div className="success-page">
        <div className="success-icon">🎉</div>
        <h2>{t(lang, 'orderSuccess')}</h2>
        <p>{t(lang, 'orderNumber')}</p>
        <div className="success-order-number">#{String(orderNumber).padStart(4, '0')}</div>
        <button className="secondary-btn" onClick={() => {
          setPage('catalog');
          refreshCart();
        }}>
          {t(lang, 'backToMenu')}
        </button>
      </div>
    );
  }

  // Checkout page
  if (page === 'checkout') {
    return (
      <>
        <header className="header">
          <div className="header-content">
            <button className="secondary-btn" onClick={() => setPage('cart')} style={{ padding: '6px 12px', fontSize: 13 }}>
              ← {t(lang, 'cart')}
            </button>
            <div className="logo">77Cheesecake</div>
          </div>
        </header>

        <div className="page">
          <div className="page-title">{t(lang, 'checkout')}</div>

          {/* Delivery type */}
          <div className="checkout-section">
            <h3>{t(lang, 'deliveryType')}</h3>
            <div className="delivery-options">
              <button
                className={`delivery-option ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                🚗 {t(lang, 'delivery')}
              </button>
              <button
                className={`delivery-option ${deliveryType === 'pickup' ? 'active' : ''}`}
                onClick={() => setDeliveryType('pickup')}
              >
                🏪 {t(lang, 'pickup')}
              </button>
            </div>
          </div>

          {/* Address */}
          {deliveryType === 'delivery' && (
            <div className="checkout-section">
              <h3>{t(lang, 'address')}</h3>
              <input
                className="input-field"
                type="text"
                placeholder={t(lang, 'enterAddress')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          )}

          {/* Comment */}
          <div className="checkout-section">
            <h3>{t(lang, 'comment')}</h3>
            <textarea
              className="input-field"
              placeholder={t(lang, 'orderComment')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Order summary */}
          <div className="checkout-section">
            <h3>{t(lang, 'cart')}</h3>
            {cart?.items?.map((item) => (
              <div key={item.id} className="order-summary-item">
                <span>
                  {getName(item.productVariant.product)} ({getUnitLabel(item.productVariant.unitType)}) × {item.quantity}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                  {formatPrice(Number(item.productVariant.price) * item.quantity)} {t(lang, 'currency')}
                </span>
              </div>
            ))}
            <div className="order-summary-total">
              <span>{t(lang, 'total')}</span>
              <span style={{ color: 'var(--accent-light)' }}>{formatPrice(cartTotal)} {t(lang, 'currency')}</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bottom-bar">
          <div className="bottom-bar-content">
            <div className="bottom-total">
              <span className="bottom-total-label">{t(lang, 'total')}</span>
              <span className="bottom-total-value">{formatPrice(cartTotal)} {t(lang, 'currency')}</span>
            </div>
            <button
              className="primary-btn"
              onClick={handlePlaceOrder}
              disabled={submitting || (deliveryType === 'delivery' && !address.trim())}
            >
              {submitting ? '...' : t(lang, 'placeOrder')}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Cart page
  if (page === 'cart') {
    return (
      <>
        <header className="header">
          <div className="header-content">
            <button className="secondary-btn" onClick={() => setPage('catalog')} style={{ padding: '6px 12px', fontSize: 13 }}>
              ← {t(lang, 'catalog')}
            </button>
            <div className="logo">77Cheesecake</div>
          </div>
        </header>

        <div className="page">
          <div className="page-title">
            {t(lang, 'cart')}
            {cart?.items && cart.items.length > 0 && (
              <button className="clear-btn" onClick={handleClearCart}>
                {t(lang, 'clearCart')}
              </button>
            )}
          </div>

          {(!cart?.items || cart.items.length === 0) ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛒</div>
              <p>{t(lang, 'emptyCart')}</p>
            </div>
          ) : (
            <>
              {cart.items.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">🍰</div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{getName(item.productVariant.product)}</div>
                    <div className="cart-item-variant">{getName(item.productVariant)} · {getUnitLabel(item.productVariant.unitType)}</div>
                    <div className="cart-item-price">
                      {formatPrice(Number(item.productVariant.price) * item.quantity)} {t(lang, 'currency')}
                    </div>
                  </div>
                  <div className="quantity-controls">
                    <button className="qty-btn decrease" onClick={() => handleUpdateQty(item.id, item.quantity - 1)}>−</button>
                    <span className="qty-value">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => handleUpdateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {cart?.items && cart.items.length > 0 && (
          <div className="bottom-bar">
            <div className="bottom-bar-content">
              <div className="bottom-total">
                <span className="bottom-total-label">{t(lang, 'total')}</span>
                <span className="bottom-total-value">{formatPrice(cartTotal)} {t(lang, 'currency')}</span>
              </div>
              <button className="primary-btn" onClick={() => setPage('checkout')}>
                {t(lang, 'placeOrder')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Catalog page (default)
  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="logo">77Cheesecake</div>
          <button className="cart-badge" onClick={() => setPage('cart')}>
            🛒 {t(lang, 'cart')}
            {cartItemCount > 0 && <span className="count">{cartItemCount}</span>}
          </button>
        </div>
      </header>

      {/* Category tabs */}
      <div className="categories">
        <button
          className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          {t(lang, 'all')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {getName(cat)}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <div className="products">
        {filteredProducts.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image">🍰</div>
            <div className="product-info">
              <div className="product-name">{getName(product)}</div>
              <div className="product-desc">{getDesc(product)}</div>
              <div className="variant-selector">
                {product.variants.map((variant) => (
                  <div key={variant.id} className="variant-row">
                    <div>
                      <span className="variant-label">{getUnitLabel(variant.unitType)}</span>
                    </div>
                    <span className="variant-price">{formatPrice(Number(variant.price))}</span>
                    <button className="add-btn" onClick={() => handleAddToCart(variant.id)}>+</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart bottom bar */}
      {cartItemCount > 0 && (
        <div className="bottom-bar">
          <div className="bottom-bar-content">
            <div className="bottom-total">
              <span className="bottom-total-label">{cartItemCount} {t(lang, 'items')}</span>
              <span className="bottom-total-value">{formatPrice(cartTotal)} {t(lang, 'currency')}</span>
            </div>
            <button className="primary-btn" onClick={() => setPage('cart')}>
              {t(lang, 'goToCart')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
