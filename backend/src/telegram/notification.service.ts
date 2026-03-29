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
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("✅ To'lov qabul qilindi", `pay:${order.id}`)],
      [
        Markup.button.callback('🚚 Yetkazib berildi', `deliver:${order.id}`),
        Markup.button.callback('❌ Bekor qilish', `cancel:${order.id}`),
      ],
    ]);

    try {
      let sentMessage: any;
      if (order.paymentScreenshot) {
        try {
          const base64 = order.paymentScreenshot.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(base64, 'base64');
          sentMessage = await this.bot.telegram.sendPhoto(
            cafeGroupChatId,
            { source: buf },
            { caption: message, parse_mode: 'HTML', reply_markup: keyboard.reply_markup } as any,
          );
        } catch (photoErr) {
          this.logger.error('Failed to send photo, sending text only', photoErr);
          sentMessage = await this.bot.telegram.sendMessage(cafeGroupChatId, message, {
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup,
          } as any);
        }
      } else {
        sentMessage = await this.bot.telegram.sendMessage(cafeGroupChatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        } as any);
      }

      // Send location pin after the order message (Fix 5)
      if (order.latitude && order.longitude) {
        const lat = Number(order.latitude);
        const lon = Number(order.longitude);
        const yandexUrl = `https://yandex.com/maps/?ll=${lon},${lat}&pt=${lon},${lat},pm2rdm&z=17`;
        try {
          await this.bot.telegram.sendLocation(cafeGroupChatId, lat, lon);
          await this.bot.telegram.sendMessage(
            cafeGroupChatId,
            '🗺 Xaritada ko\'rish:',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📍 Yandex Xaritada ochish', url: yandexUrl }],
                ],
              },
            } as any,
          );
        } catch (locErr) {
          this.logger.error('Failed to send location', locErr);
        }
      }

      return sentMessage;
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
