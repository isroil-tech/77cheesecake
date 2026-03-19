import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { I18nService } from '../i18n/i18n.service';
import { NotificationService } from './notification.service';

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

    // Clear webhook and start custom polling
    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      this.logger.log('Webhook cleared');
    } catch (e: any) {
      this.logger.error('deleteWebhook error:', e.message);
    }

    // Start custom manual polling with short timeout
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
    // /chatid
    this.bot.command('chatid', async (ctx) => {
      try {
        await ctx.reply(`📋 Chat ID: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' });
      } catch (e: any) {
        this.logger.error('chatid error', e.message);
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
          await ctx.reply(
            this.i18n.t(lang, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang, 'openMenu'), miniAppUrl)],
            ]).resize(),
          );
          return;
        }

        await ctx.reply(
          '🍰 77Cheesecake\n\n' + this.i18n.t('uz', 'selectLanguage'),
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
        this.logger.log(`Contact received from ${telegramId}: ${phone}`);

        const state = this.userStates.get(ctx.from.id);
        const lang = state?.language || 'uz';

        await this.usersService.createOrUpdate(telegramId, { phone });

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

          const miniAppUrl = this.config.get<string>('MINI_APP_URL') || '';
          if (!miniAppUrl || miniAppUrl === 'https://77cheesecake.local') {
            await ctx.reply(
              this.i18n.t(lang, 'nameReceived', { name }) + '\n\n✅ Ro\'yxatdan o\'tdingiz!',
              Markup.removeKeyboard(),
            );
            return;
          }

          await ctx.reply(
            this.i18n.t(lang, 'nameReceived', { name }) + '\n\n' + this.i18n.t(lang, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang, 'openMenu'), miniAppUrl)],
            ]).resize(),
          );
          return;
        }

        // Default
        const user = await this.usersService.findByTelegramId(telegramId);
        if (user?.phone && user?.firstName) {
          const lang = user.language || 'uz';
          const miniAppUrl = this.config.get<string>('MINI_APP_URL') || '';
          if (!miniAppUrl || miniAppUrl === 'https://77cheesecake.local') {
            await ctx.reply(this.i18n.t(lang, 'openMenuText'));
            return;
          }
          await ctx.reply(
            this.i18n.t(lang, 'openMenuText'),
            Markup.keyboard([
              [Markup.button.webApp(this.i18n.t(lang, 'openMenu'), miniAppUrl)],
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
}
