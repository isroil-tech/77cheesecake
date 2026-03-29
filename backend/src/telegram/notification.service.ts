import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private bot: Telegraf;

  constructor(
    private config: ConfigService,
    private settingsService: SettingsService,
  ) {
    this.bot = new Telegraf(this.config.get<string>('BOT_TOKEN')!);
  }

  private async getCafeGroupChatId(): Promise<string> {
    const dbValue = await this.settingsService.getCafeGroupChatId();
    if (dbValue) return dbValue;
    return this.config.get<string>('CAFE_GROUP_CHAT_ID') || '';
  }

  async sendOrderToGroup(order: any) {
    const cafeGroupChatId = await this.getCafeGroupChatId();
    if (!cafeGroupChatId) {
      this.logger.warn('CAFE_GROUP_CHAT_ID is not set, skipping group notification');
      return;
    }

    const lang = order.user?.language || 'ru';
    const isRu = lang === 'ru';

    const languageLabel = isRu ? 'Русский' : "O'zbekcha";
    const deliveryLabel = order.deliveryType === 'delivery'
      ? (isRu ? '🚗 Доставка' : '🚗 Yetkazish')
      : (isRu ? '🏪 Самовывоз' : '🏪 Olib ketish');

    const paymentLabel = order.paymentType === 'cash'
      ? (isRu ? '💵 Наличные' : '💵 Naqd')
      : order.paymentType === 'card'
        ? (isRu ? '💳 Карта (перевод)' : '💳 Karta (o\'tkazma)')
        : (isRu ? '⏳ Ожидание оплаты' : '⏳ To\'lov kutilmoqda');

    const itemLines = order.items.map((item: any, idx: number) => {
      const name = isRu ? item.productNameRu : item.productNameUz;
      const totalPrice = this.formatPrice(item.totalPrice);
      return `${idx + 1}. ${name} × ${item.quantity} = ${totalPrice} сум`;
    }).join('\n');

    const usernameLine = order.user?.username ? `🔗 @${order.user.username}` : '';
    const extraPhoneLine = order.extraPhone ? `📱 ${isRu ? 'Доп. тел' : "Qo'sh. tel"}: ${order.extraPhone}` : '';
    const floorLine = order.floor ? `🏢 ${isRu ? 'Этаж/кв' : 'Qavat/xonadon'}: ${order.floor}` : '';
    const boxFee = Number(order.boxFee || 5000);

    const message = [
      `🧾 <b>Buyurtma #${String(order.orderNumber).padStart(4, '0')}</b>`,
      '',
      `👤 Ism: ${order.user?.firstName || '-'} ${order.user?.lastName || ''}`.trim(),
      `📱 Tel: ${order.user?.phone || '-'}`,
      usernameLine,
      extraPhoneLine,
      `🌐 Til: ${languageLabel}`,
      '',
      deliveryLabel,
      order.address ? `📍 Manzil: ${order.address}` : '',
      floorLine,
      '',
      `💰 To'lov: ${paymentLabel}`,
      '',
      `📦 Mahsulotlar:`,
      itemLines,
      '',
      `📦 Qadoq: ${this.formatPrice(boxFee)} сум`,
      `💰 Jami: <b>${this.formatPrice(Number(order.totalAmount) + boxFee)} сум</b>`,
      order.comment ? `\n💬 Izoh: ${order.comment}` : '',
      '',
      `🕐 ${new Date(order.createdAt).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`,
    ].filter(Boolean).join('\n');

    // Admin action buttons
    // Build keyboard: admin buttons + optional map link at bottom
    const lat = order.latitude ? Number(order.latitude) : null;
    const lon = order.longitude ? Number(order.longitude) : null;
    const yandexUrl = lat && lon
      ? `https://yandex.com/maps/?ll=${lon},${lat}&pt=${lon},${lat},pm2rdm&z=17`
      : null;

    const keyboardRows: any[] = [
      [Markup.button.callback("✅ To'lov qabul qilindi", `pay:${order.id}`)],
      [
        Markup.button.callback('🚚 Yetkazib berildi', `deliver:${order.id}`),
        Markup.button.callback('❌ Bekor qilish', `cancel:${order.id}`),
      ],
    ];
    if (yandexUrl) {
      keyboardRows.push([{ text: '📍 Xaritada ko\'rish', url: yandexUrl }]);
    }
    const keyboard = Markup.inlineKeyboard(keyboardRows);

    try {
      // Message 1: order details + buttons (map link is last button row)
      if (order.paymentScreenshot) {
        try {
          const base64 = order.paymentScreenshot.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(base64, 'base64');
          await this.bot.telegram.sendPhoto(
            cafeGroupChatId,
            { source: buf },
            { caption: message, parse_mode: 'HTML', reply_markup: keyboard.reply_markup } as any,
          );
        } catch (photoErr) {
          this.logger.error('Failed to send photo, sending text only', photoErr);
          await this.bot.telegram.sendMessage(cafeGroupChatId, message, {
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup,
          } as any);
        }
      } else {
        await this.bot.telegram.sendMessage(cafeGroupChatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        } as any);
      }

      // Message 2: Telegram location pin (only if coords exist)
      if (lat && lon) {
        try {
          await this.bot.telegram.sendLocation(cafeGroupChatId, lat, lon);
        } catch (locErr) {
          this.logger.error('Failed to send location pin', locErr);
        }
      }
    } catch (e) {
      this.logger.error('Failed to send order to cafe group', e);
    }
  }

  async sendScreenshotToGroup(order: any, screenshot: string) {
    const cafeGroupChatId = await this.getCafeGroupChatId();
    if (!cafeGroupChatId) return;
    try {
      const base64 = screenshot.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      const orderNum = String(order.orderNumber).padStart(4, '0');
      await this.bot.telegram.sendPhoto(
        cafeGroupChatId,
        { source: buf },
        { caption: `💳 To'lov cheki — Buyurtma #${orderNum}`, parse_mode: 'HTML' },
      );
    } catch (e) {
      this.logger.error('Failed to send screenshot to group', e);
    }
  }

  private formatPrice(amount: any): string {
    return Number(amount).toLocaleString('ru-RU');
  }
}
