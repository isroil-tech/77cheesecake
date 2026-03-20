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

  /** Admin: full statistics */
  @Get('admin/stats')
  async getAdminStats(@Headers('x-telegram-id') telegramId: string) {
    this.checkAdmin(telegramId);
    return this.ordersService.getAdminStats();
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

    // Send to cafe group immediately when order is created
    this.telegramService.sendOrderToGroup(order).catch(() => {});

    // Also notify user that order is created and payment is needed
    this.telegramService.sendOrderNotification(
      telegramId,
      user.language,
      order.orderNumber,
    ).catch(() => {});

    return order;
  }

  @Post('orders/:id/payment')
  async confirmPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      paymentType: string;
      paymentScreenshot?: string;
    },
  ) {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return { error: 'Unauthorized' };

    const order = await this.ordersService.confirmPayment(
      id,
      body.paymentType,
      body.paymentScreenshot,
    );

    // Send updated order info to group with payment details
    this.telegramService.sendOrderToGroup(order).catch(() => {});

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
