import { Controller, Get, Post, Patch, Param, Body, Req, Headers, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/orders')
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

  private checkAdminKey(adminKey: string) {
    const expected = this.config.get<string>('ADMIN_KEY') || 'admin123';
    if (adminKey !== expected) throw new ForbiddenException('Invalid admin key');
  }

  /** Admin: get ALL orders */
  @Get('admin/all')
  async getAllOrders(@Headers('x-admin-key') adminKey: string) {
    this.checkAdminKey(adminKey);
    return this.ordersService.getAllOrders();
  }

  @Post()
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

  @Post(':id/payment')
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

  @Get()
  async getOrders(@Req() req: any) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.ordersService.getOrdersByUser(userId);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch(':id/status')
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
