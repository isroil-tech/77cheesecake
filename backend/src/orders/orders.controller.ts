import { Controller, Get, Post, Patch, Param, Body, Req, Headers, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private usersService: UsersService,
    private telegramService: TelegramService,
    private config: ConfigService,
  ) {}

  private async getUserId(req: any): Promise<string | null> {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return null;
    const user = await this.usersService.findByTelegramId(telegramId);
    return user?.id || null;
  }

  private checkAdmin(telegramId: string) {
    const adminIds = (this.config.get<string>('ADMIN_TELEGRAM_IDS') || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    if (!adminIds.includes(telegramId)) {
      throw new ForbiddenException('Access denied');
    }
  }

  /** Public: app settings (card number etc.) */
  @Get('settings')
  getSettings() {
    return {
      cardNumber: this.config.get<string>('CARD_NUMBER') || '',
      cardHolder: this.config.get<string>('CARD_HOLDER') || '77CHEESECAKE',
    };
  }

  /** Admin: verify if user is admin */
  @Get('admin/verify')
  async verifyAdmin(@Headers('x-telegram-id') telegramId: string) {
    try {
      this.checkAdmin(telegramId);
      return { isAdmin: true };
    } catch {
      return { isAdmin: false };
    }
  }

  /** Admin: get ALL orders */
  @Get('admin/all')
  async getAllOrders(@Headers('x-telegram-id') telegramId: string) {
    this.checkAdmin(telegramId);
    return this.ordersService.getAllOrders();
  }

  /** Admin: full order statistics */
  @Get('admin/stats')
  async getAdminStats(@Headers('x-telegram-id') telegramId: string) {
    this.checkAdmin(telegramId);
    return this.ordersService.getAdminStats();
  }

  /** Admin: bot & user statistics */
  @Get('admin/bot-stats')
  async getBotStats(@Headers('x-telegram-id') telegramId: string) {
    this.checkAdmin(telegramId);
    return this.usersService.getBotStats();
  }

  /** Admin: all users list */
  @Get('admin/users')
  async getUsers(@Headers('x-telegram-id') telegramId: string) {
    this.checkAdmin(telegramId);
    return this.usersService.getAllUsers();
  }

  /** Admin: broadcast to all users */
  @Post('admin/broadcast')
  async broadcast(
    @Headers('x-telegram-id') telegramId: string,
    @Body() body: { message: string },
  ) {
    this.checkAdmin(telegramId);
    const users = await this.usersService.getAllUsers();
    const realUsers = users.filter(u => !u.telegramId.startsWith('guest-'));
    let sent = 0, failed = 0;
    for (const user of realUsers) {
      try {
        await this.telegramService.sendDirectMessage(user.telegramId, body.message);
        sent++;
        await new Promise(r => setTimeout(r, 50)); // Rate limit
      } catch { failed++; }
    }
    return { sent, failed, total: realUsers.length };
  }

  /** Admin: send message to specific user */
  @Post('admin/message')
  async sendMessage(
    @Headers('x-telegram-id') telegramId: string,
    @Body() body: { targetTelegramId: string; message: string },
  ) {
    this.checkAdmin(telegramId);
    await this.telegramService.sendDirectMessage(body.targetTelegramId, body.message);
    return { success: true };
  }


  @Post('orders')
  async createOrder(
    @Req() req: any,
    @Body() body: {
      deliveryType: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      comment?: string;
      extraPhone?: string;
      floor?: string;
      items?: any[];
    },
  ) {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return { error: 'Unauthorized' };
    let user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      user = await this.usersService.createOrUpdate(telegramId, {});
    }

    const order = await this.ordersService.createOrder(user.id, body);
    return order;
  }

  @Post('orders/:id/payment')
  async confirmPayment(
    @Param('id') id: string,
    @Body() body: {
      paymentType: string;
      paymentScreenshot?: string;
    },
  ) {
    const order = await this.ordersService.confirmPayment(
      id,
      body.paymentType,
      body.paymentScreenshot,
    );

    // Send full order details to group
    this.telegramService.sendOrderToGroup(order).catch(() => {});

    // Notify buyer AFTER payment confirmed
    if (order?.user) {
      this.telegramService.sendOrderNotification(
        order.user.telegramId,
        order.user.language,
        order.orderNumber,
      ).catch(() => {});

      // Birthday prompt on first valid order
      this.ordersService.getUserOrderCount(order.userId).then(count => {
        if (count === 1) {
          this.telegramService.promptForBirthday(order.user.telegramId, order.user.language).catch(() => {});
        }
      }).catch(() => {});
    }

    return order;
  }

  @Get('orders')
  async getOrders(@Req() req: any) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.ordersService.getOrdersByUser(userId);
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch('orders/:id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const order = await this.ordersService.updateOrderStatus(id, body.status);

    // Notify user about status change
    if (order?.user) {
      this.telegramService.sendStatusUpdate(
        order.user.telegramId,
        order.user.language,
        order.orderNumber,
        body.status,
      ).catch(() => {});
    }

    return order;
  }
}
