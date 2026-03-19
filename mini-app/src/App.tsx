import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { t } from './i18n';
import type { Category, Product, Cart } from './types';

type Page = 'catalog' | 'cart' | 'checkout' | 'payment' | 'success';

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
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLon, setAddressLon] = useState<number | undefined>();
  const [comment, setComment] = useState('');
  const [orderNumber, setOrderNumber] = useState<number>(0);
  const [orderId, setOrderId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Payment state
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('cash');
  const [paymentScreenshot, setPaymentScreenshot] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{display_name: string; lat: string; lon: string}>>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<any>(null);

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
        const authRes = await api.authTelegram(telegramId);
        if (authRes.user) {
          setLang(authRes.user.language || 'uz');
        }
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

  // Debounced address search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (addressQuery.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setAddressSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.searchAddress(addressQuery);
        setAddressSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setAddressSuggestions([]);
      }
      setAddressSearching(false);
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [addressQuery]);

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
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
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
        latitude: addressLat,
        longitude: addressLon,
        comment: comment.trim() || undefined,
      });
      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setPage('payment');
      setCart(null);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const handleConfirmPayment = async () => {
    if (!telegramId || !orderId || paymentSubmitting) return;
    if (paymentType === 'card' && !paymentScreenshot) return;

    setPaymentSubmitting(true);
    try {
      await api.confirmPayment(telegramId, orderId, {
        paymentType,
        paymentScreenshot: paymentType === 'card' ? paymentScreenshot : undefined,
      });
      setPage('success');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      console.error(err);
    }
    setPaymentSubmitting(false);
  };

  const handleSelectAddress = (suggestion: {display_name: string; lat: string; lon: string}) => {
    setAddress(suggestion.display_name);
    setAddressQuery(suggestion.display_name);
    setAddressLat(parseFloat(suggestion.lat));
    setAddressLon(parseFloat(suggestion.lon));
    setShowSuggestions(false);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
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

  // Payment page
  if (page === 'payment') {
    return (
      <>
        <header className="header">
          <div className="header-content">
            <div className="logo">77Cheesecake</div>
          </div>
        </header>

        <div className="page">
          <div className="page-title">{t(lang, 'payment')}</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
            {lang === 'ru' ? `Заказ #${String(orderNumber).padStart(4, '0')} — ${formatPrice(cartTotal || 0)} сум` : `Buyurtma #${String(orderNumber).padStart(4, '0')} — ${formatPrice(cartTotal || 0)} so'm`}
          </p>

          {/* Payment method selection */}
          <div className="checkout-section">
            <h3>{t(lang, 'paymentMethod')}</h3>
            <div className="delivery-options">
              <button
                className={`delivery-option ${paymentType === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentType('cash')}
              >
                💵 {t(lang, 'cashPayment')}
              </button>
              <button
                className={`delivery-option ${paymentType === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentType('card')}
              >
                💳 {t(lang, 'cardPayment')}
              </button>
            </div>
          </div>

          {paymentType === 'cash' && (
            <div className="checkout-section">
              <div className="payment-info-card">
                <div className="payment-info-icon">💵</div>
                <p>{t(lang, 'cashDesc')}</p>
              </div>
            </div>
          )}

          {paymentType === 'card' && (
            <div className="checkout-section">
              <div className="payment-info-card">
                <div className="payment-info-icon">💳</div>
                <p>{t(lang, 'cardDesc')}</p>
                <div className="card-number-box">
                  <span className="card-number-label">{t(lang, 'cardNumber')}:</span>
                  <span className="card-number-value">8600 1234 5678 9012</span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    style={{ display: 'none' }}
                  />
                  {paymentScreenshot ? (
                    <span className="upload-success">✅ {t(lang, 'screenshotUploaded')}</span>
                  ) : (
                    <span>📷 {t(lang, 'uploadScreenshot')}</span>
                  )}
                </label>
                {paymentScreenshot && (
                  <img src={paymentScreenshot} alt="Payment screenshot" className="screenshot-preview" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="bottom-bar">
          <div className="bottom-bar-content">
            <button
              className="primary-btn"
              onClick={handleConfirmPayment}
              disabled={paymentSubmitting || (paymentType === 'card' && !paymentScreenshot)}
              style={{ width: '100%' }}
            >
              {paymentSubmitting ? '...' : t(lang, 'confirmPayment')}
            </button>
          </div>
        </div>
      </>
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

          {/* Address with autocomplete */}
          {deliveryType === 'delivery' && (
            <div className="checkout-section">
              <h3>{t(lang, 'address')}</h3>
              <div className="address-autocomplete">
                <input
                  className="input-field"
                  type="text"
                  placeholder={t(lang, 'enterAddress')}
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setAddress(e.target.value);
                    setAddressLat(undefined);
                    setAddressLon(undefined);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowSuggestions(true);
                  }}
                />
                {addressSearching && (
                  <div className="address-searching">{t(lang, 'searchingAddress')}</div>
                )}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="address-suggestions">
                    {addressSuggestions.map((s, i) => (
                      <button
                        key={i}
                        className="address-suggestion-item"
                        onClick={() => handleSelectAddress(s)}
                      >
                        📍 {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && !addressSearching && addressQuery.length >= 3 && addressSuggestions.length === 0 && (
                  <div className="address-searching">{t(lang, 'noResults')}</div>
                )}
              </div>
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
