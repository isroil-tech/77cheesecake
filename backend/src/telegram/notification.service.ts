import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private bot: Telegraf;
  private cafeGroupChatId: string;

  constructor(private config: ConfigService) {
    this.bot = new Telegraf(this.config.get<string>('BOT_TOKEN')!);
    this.cafeGroupChatId = this.config.get<string>('CAFE_GROUP_CHAT_ID') || '';
  }

  async sendOrderToGroup(order: any) {
    if (!this.cafeGroupChatId) {
      this.logger.warn('CAFE_GROUP_CHAT_ID is not set, skipping group notification');
      return;
    }

    const lang = order.user?.language || 'ru';
    const isRu = lang === 'ru';

    const languageLabel = isRu ? 'Русский' : "O'zbekcha";
    const deliveryLabel = order.deliveryType === 'delivery'
      ? (isRu ? '🚗 Доставка' : '🚗 Yetkazish')
      : (isRu ? '🏪 Самовывоз' : '🏪 Olib ketish');

    // Build items list
    const itemLines = order.items.map((item: any, idx: number) => {
      const name = isRu ? item.productNameRu : item.productNameUz;
      const variant = isRu ? item.variantNameRu : item.variantNameUz;
      const unitLabel = this.getUnitLabel(item.unitType, isRu);
      const unitPrice = this.formatPrice(item.unitPrice);
      const totalPrice = this.formatPrice(item.totalPrice);
      return `${idx + 1}. ${name} (${variant}) × ${item.quantity} = ${totalPrice} сум`;
    }).join('\n');

    const message = [
      `🧾 <b>${isRu ? 'Заказ' : 'Buyurtma'} #${String(order.orderNumber).padStart(4, '0')}</b>`,
      '',
      `👤 ${isRu ? 'Имя' : 'Ism'}: ${order.user?.firstName || '-'} ${order.user?.lastName || ''}`.trim(),
      `📱 ${isRu ? 'Тел' : 'Tel'}: ${order.user?.phone || '-'}`,
      `🌐 ${isRu ? 'Язык' : 'Til'}: ${languageLabel}`,
      '',
      deliveryLabel,
      order.address ? `📍 ${isRu ? 'Адрес' : 'Manzil'}: ${order.address}` : '',
      order.latitude ? `📍 GPS: ${order.latitude}, ${order.longitude}` : '',
      '',
      `📦 ${isRu ? 'Товары' : 'Mahsulotlar'}:`,
      itemLines,
      '',
      `💰 ${isRu ? 'Итого' : 'Jami'}: <b>${this.formatPrice(order.totalAmount)} сум</b>`,
      order.comment ? `\n💬 ${isRu ? 'Комментарий' : 'Izoh'}: ${order.comment}` : '',
      '',
      `🕐 ${new Date(order.createdAt).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`,
    ].filter(Boolean).join('\n');

    try {
      await this.bot.telegram.sendMessage(this.cafeGroupChatId, message, {
        parse_mode: 'HTML',
      });
      this.logger.log(`Order #${order.orderNumber} sent to cafe group`);
    } catch (e) {
      this.logger.error('Failed to send order to cafe group', e);
    }
  }

  private getUnitLabel(unitType: string, isRu: boolean): string {
    const labels: Record<string, Record<string, string>> = {
      whole: { ru: 'Целый', uz: 'Butun' },
      slice: { ru: 'Кусок', uz: "Bo'lak" },
      piece: { ru: 'Штука', uz: 'Dona' },
    };
    return labels[unitType]?.[isRu ? 'ru' : 'uz'] || unitType;
  }

  private formatPrice(amount: any): string {
    return Number(amount).toLocaleString('ru-RU');
  }
}
