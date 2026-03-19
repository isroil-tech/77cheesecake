import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { UsersService } from '../users/users.service';

@Controller('api/v1/cart')
export class CartController {
  constructor(
    private cartService: CartService,
    private usersService: UsersService,
  ) {}

  private async getUserId(req: any): Promise<string | null> {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return null;
    const user = await this.usersService.findByTelegramId(telegramId);
    return user?.id || null;
  }

  @Get()
  async getCart(@Req() req: any) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.cartService.getOrCreateCart(userId);
  }

  @Post('items')
  async addItem(@Req() req: any, @Body() body: { productVariantId: string; quantity?: number }) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.cartService.addItem(userId, body.productVariantId, body.quantity || 1);
  }

  @Patch('items/:id')
  async updateItem(@Req() req: any, @Param('id') id: string, @Body() body: { quantity: number }) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.cartService.updateItemQuantity(userId, id, body.quantity);
  }

  @Delete('items/:id')
  async removeItem(@Req() req: any, @Param('id') id: string) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.cartService.removeItem(userId, id);
  }

  @Delete()
  async clearCart(@Req() req: any) {
    const userId = await this.getUserId(req);
    if (!userId) return { error: 'Unauthorized' };
    return this.cartService.clearCart(userId);
  }
}
