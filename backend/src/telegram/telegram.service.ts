import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { I18nService } from '../i18n/i18n.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);
  private userStates = new Map<number, { step: string; language?: string }>();
  private pollingActive = false;
  private pollOffset = 0;

  constructor(
    private config: ConfigService,
    private usersService: UsersService,
    private i18n: I18nService,
    private notificationService: NotificationService,
    private prisma: PrismaService,
  ) {
    this.bot = new Telegraf(this.config.get<string>('BOT_TOKEN')!);
  }

  getBot(): Telegraf { return this.bot; }
  getNotificationService(): NotificationService { return this.notificationService; }

  async onModuleInit() {
    this.bot.catch((err: any) => {
      this.logger.error('Bot error:', err);
    });

    this.setupHandlers();

    // Run bot startup in background so HTTP server starts immediately
    // (prevents Railway health check SIGTERM on slow Telegram API calls)
    setTimeout(() => {
      this.initBot().catch((e: any) => {
        this.logger.error('Bot init error:', e.message);
      });
    }, 0);
  }

  private async initBot() {
    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      this.logger.log('Webhook cleared');
    } catch (e: any) {
      this.logger.error('deleteWebhook error:', e.message);
    }

    this.pollingActive = true;
    this.startCustomPolling();
    this.logger.log('🤖 Telegram bot started with custom polling');
  }

  async onModuleDestroy() {
    this.pollingActive = false;
  }

  private async startCustomPolling() {
    while (this.pollingActive) {
      try {
        const updates = await this.bot.telegram.callApi('getUpdates', {
          offset: this.pollOffset,
          limit: 100,
          timeout: 5, // Short 5s timeout instead of default 30s
          allowed_updates: ['message', 'callback_query'],
        }) as any[];

        if (updates && updates.length > 0) {
          for (const update of updates) {
            this.pollOffset = update.update_id + 1;
            try {
              await this.bot.handleUpdate(update);
            } catch (e: any) {
              this.logger.error('handleUpdate error:', e.message);
            }
          }
        }
      } catch (e: any) {
        if (e.message?.includes('Conflict')) {
          this.logger.warn('Polling conflict detected, retrying in 3s...');
          await new Promise(r => setTimeout(r, 3000));
        } else {
          this.logger.error('Polling error:', e.message);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  private setupHandlers() {
    // ─── Admin inline button callbacks (dynamic keyboard) ─────────────────
    // Status flow: new → ready → delivered
    // Each keyboard includes an undo button for the previous state
    const getNextKeyboard = (status: string, orderId: string, mapUrl?: string | null) => {
      const mapRow = mapUrl ? [{ text: '📍 Xaritada ko\'rish', url: mapUrl }] : null;

      const rows: any[] = (() => {
        switch (status) {
          case 'new':
            return [
              [{ text: "✅ To'lov qabul qilindi", callback_data: `pay:${orderId}` }],
              [{ text: '❌ Bekor qilish', callback_data: `cancel:${orderId}` }],
            ];
          case 'ready':
            return [
              [{ text: '🚚 Yetkazib berildi', callback_data: `deliver:${orderId}` }],
              [{ text: '↩️ Orqaga (new)', callback_data: `undo:${orderId}:new` }],
              [{ text: '❌ Bekor qilish', callback_data: `cancel:${orderId}` }],
            ];
          case 'delivered':
            return [
              [{ text: '✅ Yetkazib berildi', callback_data: 'noop' }],
              [{ text: '↩️ Orqaga (ready)', callback_data: `undo:${orderId}:ready` }],
            ];
          case 'cancelled':
            return [
              [{ text: '❌ Bekor qilindi', callback_data: 'noop' }],
              [{ text: '↩️ Orqaga (new)', callback_data: `undo:${orderId}:new` }],
            ];
          default:
            return [[{ text: `📋 ${status}`, callback_data: 'noop' }]];
        }
      })();

      if (mapRow) rows.push(mapRow);
      return { inline_keyboard: rows };
    };

    const handleOrderAction = async (ctx: any, status: string, label: string) => {
      try {
        const data: string = (ctx.callbackQuery as any)?.data || '';
        const orderId = data.split(':')[1];
        if (!orderId) { await ctx.answerCbQuery('ID topilmadi'); return; }

        const order = await (this.prisma as any).order.update({
          where: { id: orderId },
          data: { status },
          include: { user: true, items: true },
        });

        // Notify customer
        if (order.user?.telegramId && !order.user.telegramId.startsWith('guest-')) {
          await this.sendStatusUpdate(order.user.telegramId, order.user.language || 'uz', order.orderNumber, status).catch(() => {});
        }

        // Build map URL if coords exist (persist map button across status changes)
        const lat = (order as any).latitude ? Number((order as any).latitude) : null;
        const lon = (order as any).longitude ? Number((order as any).longitude) : null;
        const mapUrl = lat && lon
          ? `https://yandex.com/maps/?ll=${lon},${lat}&pt=${lon},${lat},pm2rdm&z=17`
          : null;

        // Update keyboard preserving map button
        await ctx.editMessageReplyMarkup(getNextKeyboard(status, orderId, mapUrl)).catch(() => {});

        await ctx.answerCbQuery(`✅ ${label}`);
        this.logger.log(`Order #${order.orderNumber} → ${status}`);
      } catch (e: any) {
        this.logger.error(`Order action (${status}):`, e.message);
        await ctx.answerCbQuery('Xatolik!').catch(() => {});
      }
    };

    this.bot.action(/^pay:(.+)$/, (ctx) => handleOrderAction(ctx, 'ready', "✅ To'lov qabul qilindi"));
    this.bot.action(/^deliver:(.+)$/, (ctx) => handleOrderAction(ctx, 'delivered', '🚚 Yetkazib berildi'));
    this.bot.action(/^cancel:(.+)$/, (ctx) => handleOrderAction(ctx, 'cancelled', '❌ Bekor qilindi'));
    this.bot.action('noop', (ctx) => ctx.answerCbQuery().catch(() => {}));

    // Undo: revert order to previous status
    this.bot.action(/^undo:(.+):(.+)$/, async (ctx) => {
      try {
        const data: string = (ctx.callbackQuery as any)?.data || '';
        const parts = data.split(':');
        const orderId = parts[1];
        const prevStatus = parts[2];
        if (!orderId || !prevStatus) { await ctx.answerCbQuery('ID topilmadi'); return; }

        const order = await (this.prisma as any).order.update({
          where: { id: orderId },
          data: { status: prevStatus },
        });

        const lat = order?.latitude ? Number(order.latitude) : null;
        const lon = order?.longitude ? Number(order.longitude) : null;
        const mapUrl = lat && lon
          ? `https://yandex.com/maps/?ll=${lon},${lat}&pt=${lon},${lat},pm2rdm&z=17`
          : null;

        await ctx.editMessageReplyMarkup(getNextKeyboard(prevStatus, orderId, mapUrl)).catch(() => {});
        await ctx.answerCbQuery(`↩️ ${prevStatus} ga qaytarildi`);
        this.logger.log(`Order ${orderId} reverted → ${prevStatus}`);
      } catch (e: any) {
        this.logger.error('undo error:', e.message);
        await ctx.answerCbQuery('Xatolik!').catch(() => {});
      }
    });
    // ─────────────────────────────────────────────────────────────────────


    // /chatid
    this.bot.command('chatid', async (ctx) => {
      try {
        await ctx.reply(`📋 Chat ID: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' });
      } catch (e: any) {
        this.logger.error('chatid error', e.message);
      }
    });

    // /resetme (for testing)
    this.bot.command('resetme', async (ctx) => {
      try {
        await this.usersService.deleteByTelegramId(ctx.from.id.toString());
        this.userStates.delete(ctx.from.id);
        await ctx.reply('🗑 Profilingiz bazadan tozalandi.\n\nIltimos, qaytadan /start ni bosing.', Markup.removeKeyboard());
      } catch (e: any) {
        this.logger.error('resetme error', e.message);
      }
    });

    // /admin
    this.bot.command('admin', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const adminIds = (this.config.get<string>('ADMIN_TELEGRAM_IDS') || '')
          .split(',').map(id => id.trim()).filter(Boolean);

        if (!adminIds.includes(telegramId)) {
          await ctx.reply('❌ Siz admin emassiz.');
          return;
        }

        const miniAppUrl = this.config.get<string>('MINI_APP_URL') || '';
        const adminUrl = miniAppUrl.replace(/\/$/, '') + '/admin/';

        await ctx.reply(
          '🔐 Admin panel:',
          Markup.inlineKeyboard([
            [Markup.button.webApp('⚙️ Admin Panelni Ochish', adminUrl)],
          ]),
        );
      } catch (e: any) {
        this.logger.error('admin command error:', e.message);
      }
    });

    // /start
    this.bot.start(async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        this.logger.log(`/start from ${telegramId}`);
        const existing = await this.usersService.findByTelegramId(telegramId);

        if (existing?.phone && existing?.firstName) {
          const lang = existing.language || 'uz';
          const miniAppUrl = this.config.get<string>('MINI_APP_URL') || '';
                  if (!miniAppUrl || miniAppUrl === 'https://77cheesecake.local') {
            await ctx.reply(this.i18n.t(lang, 'openMenuText') + '\n\n⚠️ Mini App hali sozlanmagan');
            return;
          }
          const personalUrl = `${miniAppUrl.replace(/\/$/, '')}?uid=${telegramId}`;
          await ctx.reply(
            this.i18n.t(lang, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang, 'openMenu'), personalUrl)],
            ]).resize(),
          );
          return;
        }

        await ctx.reply(
          '🍰 77CHEESECAKE\n\n' + this.i18n.t('uz', 'selectLanguage'),
          Markup.inlineKeyboard([
            [
              Markup.button.callback("🇺🇿 O'zbekcha", 'lang_uz'),
              Markup.button.callback('🇷🇺 Русский', 'lang_ru'),
            ],
          ]),
        );
      } catch (e: any) {
        this.logger.error('start error:', e.message);
        await ctx.reply('❌ Xatolik yuz berdi. Qaytadan /start bosing.');
      }
    });

    // Language callbacks
    this.bot.action('lang_uz', async (ctx) => {
      this.logger.log('lang_uz callback received');
      try {
        await this.handleLanguageSelection(ctx, 'uz');
      } catch (e: any) {
        this.logger.error('lang_uz error:', e.message, e.stack);
        try { await ctx.answerCbQuery('Xatolik!'); } catch (_) {}
      }
    });

    this.bot.action('lang_ru', async (ctx) => {
      this.logger.log('lang_ru callback received');
      try {
        await this.handleLanguageSelection(ctx, 'ru');
      } catch (e: any) {
        this.logger.error('lang_ru error:', e.message, e.stack);
        try { await ctx.answerCbQuery('Ошибка!'); } catch (_) {}
      }
    });

    // Phone contact
    this.bot.on('contact', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const phone = ctx.message.contact.phone_number;
        const username = ctx.from.username || undefined;
        this.logger.log(`Contact received from ${telegramId}: ${phone}`);

        const state = this.userStates.get(ctx.from.id);
        const lang = state?.language || 'uz';

        await this.usersService.createOrUpdate(telegramId, { phone, username });

        await ctx.reply(
          this.i18n.t(lang, 'phoneReceived') + '\n\n' + this.i18n.t(lang, 'enterName'),
          Markup.removeKeyboard(),
        );

        this.userStates.set(ctx.from.id, { step: 'awaiting_name', language: lang });
      } catch (e: any) {
        this.logger.error('contact error:', e.message);
      }
    });

    // Text (name input)
    this.bot.on('text', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const state = this.userStates.get(ctx.from.id);

        if (state?.step === 'awaiting_name') {
          const lang = state.language || 'uz';
          const name = ctx.message.text.trim();
          this.logger.log(`Name received from ${telegramId}: ${name}`);

          await this.usersService.createOrUpdate(telegramId, { firstName: name });
          this.userStates.delete(ctx.from.id);

                    const miniAppUrl2 = this.config.get<string>('MINI_APP_URL') || '';
          if (!miniAppUrl2 || miniAppUrl2 === 'https://77cheesecake.local') {
            await ctx.reply(this.i18n.t(lang, 'nameReceived', { name }) + '\n\n✅ Ro\'yxatdan o\'tdingiz!');
            return;
          }
          const personalUrl2 = `${miniAppUrl2.replace(/\/$/, '')}?uid=${telegramId}`;
          await ctx.reply(
            this.i18n.t(lang, 'nameReceived', { name }) + '\n\n' + this.i18n.t(lang, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang, 'openMenu'), personalUrl2)],
            ]).resize(),
          );
          return;
        }

        // Default
        const user = await this.usersService.findByTelegramId(telegramId);
        if (user?.phone && user?.firstName) {
                    const lang3 = user.language || 'uz';
          const miniAppUrl3 = this.config.get<string>('MINI_APP_URL') || '';
          if (!miniAppUrl3 || miniAppUrl3 === 'https://77cheesecake.local') {
            await ctx.reply(this.i18n.t(lang3, 'openMenuText'));
            return;
          }
          const personalUrl3 = `${miniAppUrl3.replace(/\/$/, '')}?uid=${telegramId}`;
          await ctx.reply(
            this.i18n.t(lang3, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang3, 'openMenu'), personalUrl3)],
            ]).resize(),
          );
        }
      } catch (e: any) {
        this.logger.error('text error:', e.message);
      }
    });
  }

  private async handleLanguageSelection(ctx: any, lang: string) {
    const telegramId = ctx.from.id.toString();
    this.logger.log(`Language selected: ${lang} by ${telegramId}`);

    await this.usersService.createOrUpdate(telegramId, { language: lang });
    this.logger.log(`User created/updated for ${telegramId}`);

    await ctx.answerCbQuery();
    await ctx.editMessageText(this.i18n.t(lang, 'languageSet'));

    this.userStates.set(ctx.from.id, { step: 'awaiting_phone', language: lang });

    await ctx.reply(
      this.i18n.t(lang, 'sharePhone'),
      Markup.keyboard([
        [Markup.button.contactRequest(this.i18n.t(lang, 'sharePhoneButton'))],
      ]).oneTime().resize(),
    );
    this.logger.log(`Phone request sent to ${telegramId}`);
  }

  async sendOrderNotification(telegramId: string, lang: string, orderNumber: number) {
    // Don't send to guest IDs or invalid IDs
    if (!telegramId || telegramId.startsWith('guest-') || isNaN(Number(telegramId))) return;
    try {
      await this.bot.telegram.sendMessage(
        telegramId,
        this.i18n.t(lang, 'orderPlaced', { orderNumber: orderNumber.toString() }),
      );
    } catch (e) {
      this.logger.error(`Failed to send order notification to ${telegramId}`, e);
    }
  }

  async sendOrderToGroup(order: any) {
    await this.notificationService.sendOrderToGroup(order);
  }

  async sendScreenshotToGroup(order: any, screenshot: string) {
    await this.notificationService.sendScreenshotToGroup(order, screenshot);
  }

  async sendStatusUpdate(telegramId: string, lang: string, orderNumber: number, status: string) {
    const statusKey = `order${status.charAt(0).toUpperCase() + status.slice(1)}`;
    const statusText = this.i18n.t(lang, statusKey);
    try {
      await this.bot.telegram.sendMessage(
        telegramId,
        this.i18n.t(lang, 'orderStatusUpdate', {
          orderNumber: orderNumber.toString(),
          status: statusText,
        }),
      );
    } catch (e) {
      this.logger.error(`Failed to send status update to ${telegramId}`, e);
    }
  }

  async sendDirectMessage(telegramId: string, text: string) {
    await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML' });
  }
}

