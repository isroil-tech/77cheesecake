import re

path = 'backend/src/telegram/telegram.service.ts'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

broadcast_logic = """
    // /broadcast command
    this.bot.command('broadcast', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const adminIds = (this.config.get<string>('ADMIN_TELEGRAM_IDS') || '')
          .split(',').map(id => id.trim()).filter(Boolean);
        if (!adminIds.includes(telegramId)) return;

        this.userStates.set(ctx.from.id, { step: 'awaiting_broadcast_target' });
        await ctx.reply(
          '📢 Xabar qaysi auditoriyaga yuborilsin?',
          Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇿 O'zbek tili", 'bc_uz'), Markup.button.callback("🇷🇺 Rus tili", 'bc_ru')],
            [Markup.button.callback("🌐 Barcha (Hammasi)", 'bc_all')],
            [Markup.button.callback("❌ Bekor qilish", 'bc_cancel')],
          ])
        );
      } catch (e: any) {
        this.logger.error('broadcast command error:', e.message);
      }
    });

    this.bot.action(/^bc_(uz|ru|all|cancel)$/, async (ctx) => {
      try {
        const action = (ctx as any).match[1];
        if (action === 'cancel') {
          this.userStates.delete(ctx.from.id);
          await ctx.editMessageText('❌ Bekor qilindi.');
          return;
        }
        this.userStates.set(ctx.from.id, { step: 'awaiting_broadcast_text', language: action });
        await ctx.editMessageText(`📝 Yaxshi. Endi yuboriladigan xabar matni, rasm yoki videoni ushbu botga yuboring:`);
      } catch (e: any) {
        this.logger.error('bc_ callback error:', e.message);
      }
    });
"""

# Insert before // /start
code = code.replace('    // /start\n', broadcast_logic + '\n    // /start\n')

# Replace on('text') with on('message')
code = code.replace("this.bot.on('text', async (ctx) => {", "this.bot.on('message', async (ctx: any) => {")

# Extract msg from ctx.message
message_logic = """
        if (state?.step === 'awaiting_broadcast_text') {
          const targetLang = state.language;
          this.userStates.delete(ctx.from.id);
          const users = await this.usersService.getAllUsers();
          const targetUsers = users.filter(u => {
             if (u.telegramId.startsWith('guest-') || !u.isActive) return false;
             if (targetLang === 'all') return true;
             return (u.language || 'uz') === targetLang;
          });
          
          await ctx.reply(`⏳ Yuborilmoqda: ${targetUsers.length} ta foydalanuvchiga...`);
          let sent = 0, failed = 0;
          for (const u of targetUsers) {
             try {
               await ctx.telegram.copyMessage(u.telegramId, ctx.chat.id, ctx.message.message_id);
               sent++;
               await new Promise(resolve => setTimeout(resolve, 50));
             } catch (e) { failed++; }
          }
          await ctx.reply(`✅ Yuborildi: ${sent} ta\\n❌ Xato: ${failed} ta`);
          return;
        }

        const text = ctx.message.text ? ctx.message.text.trim() : '';

        // Birthday capture logic
        if (text.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
           const user = await this.usersService.findByTelegramId(telegramId);
           if (user && !user['birthDate']) { // Since Prisma generates types lazily, use bracket notation just in case
              await this.usersService.createOrUpdate(telegramId, { birthDate: text } as any);
              const langMsg = (user.language || 'uz') === 'uz' ? "🎉 Tug'ilgan sanangiz qabul qilindi! Rahmat!" : "🎉 Дата вашего рождения сохранена! Спасибо!";
              await ctx.reply(langMsg);
              return;
           }
        }
"""

# Insert inside the on('message') block, right after `const state = this.userStates.get(ctx.from.id);`
code = code.replace("        if (state?.step === 'awaiting_name') {", message_logic + "        if (state?.step === 'awaiting_name') {\n          if (!text) { await ctx.reply('Iltimos faqat matn yuboring'); return; }")

# Replace `const name = ctx.message.text.trim();` with `const name = text;` inside `awaiting_name` step
code = code.replace("const name = ctx.message.text.trim();", "const name = text;")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
