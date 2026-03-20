import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
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
    // Try DB first, then env fallback
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

    // Payment type
    const paymentLabel = order.paymentType === 'cash'
      ? (isRu ? '💵 Наличные' : '💵 Naqd')
      : order.paymentType === 'card'
        ? (isRu ? '💳 Карта (перевод)' : '💳 Karta (o\'tkazma)')
        : (isRu ? '⏳ Ожидание оплаты' : '⏳ To\'lov kutilmoqda');

    // Build items list
    const itemLines = order.items.map((item: any, idx: number) => {
      const name = isRu ? item.productNameRu : item.productNameUz;
      const totalPrice = this.formatPrice(item.totalPrice);
      return `${idx + 1}. ${name} × ${item.quantity} = ${totalPrice} сум`;
    }).join('\n');

    const usernameLine = order.user?.username ? `🔗 @${order.user.username}` : '';
    const extraPhoneLine = order.extraPhone ? `📱 ${isRu ? 'Доп. тел' : "Qo'sh. tel"}: ${order.extraPhone}` : '';
    const boxFee = Number(order.boxFee || 5000);

    const message = [
      `🧾 <b>${isRu ? 'Заказ' : 'Buyurtma'} #${String(order.orderNumber).padStart(4, '0')}</b>`,
      '',
      `👤 ${isRu ? 'Имя' : 'Ism'}: ${order.user?.firstName || '-'} ${order.user?.lastName || ''}`.trim(),
      `📱 ${isRu ? 'Тел' : 'Tel'}: ${order.user?.phone || '-'}`,
      usernameLine,
      extraPhoneLine,
      `🌐 ${isRu ? 'Язык' : 'Til'}: ${languageLabel}`,
      '',
      deliveryLabel,
      order.address ? `📍 ${isRu ? 'Адрес' : 'Manzil'}: ${order.address}` : '',
      order.latitude ? `📍 GPS: ${order.latitude}, ${order.longitude}` : '',
      '',
      `💰 ${isRu ? 'Оплата' : "To'lov"}: ${paymentLabel}`,
      '',
      `📦 ${isRu ? 'Товары' : 'Mahsulotlar'}:`,
      itemLines,
      '',
      `📦 ${isRu ? 'Упаковка' : 'Qadoq'}: ${this.formatPrice(boxFee)} сум`,
      `💰 ${isRu ? 'Итого' : 'Jami'}: <b>${this.formatPrice(Number(order.totalAmount) + boxFee)} сум</b>`,
      order.comment ? `\n💬 ${isRu ? 'Комментарий' : 'Izoh'}: ${order.comment}` : '',
      '',
      `🕐 ${new Date(order.createdAt).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`,
    ].filter(Boolean).join('\n');

    try {
      // If payment screenshot exists, send order info + screenshot as one message
      if (order.paymentScreenshot) {
        try {
          const base64 = order.paymentScreenshot.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(base64, 'base64');
          await this.bot.telegram.sendPhoto(
            cafeGroupChatId,
            { source: buf },
            { caption: message, parse_mode: 'HTML' }
          );
        } catch (photoErr) {
          this.logger.error('Failed to send photo, sending text only', photoErr);
          await this.bot.telegram.sendMessage(cafeGroupChatId, message, { parse_mode: 'HTML' });
        }
      } else {
        await this.bot.telegram.sendMessage(cafeGroupChatId, message, { parse_mode: 'HTML' });
      }

      this.logger.log(`Order #${order.orderNumber} sent to cafe group`);
    } catch (e) {
      this.logger.error('Failed to send order to cafe group', e);
    }
  }

  private formatPrice(amount: any): string {
    return Number(amount).toLocaleString('ru-RU');
  }
}
