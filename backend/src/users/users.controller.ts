import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return { error: 'Missing telegram ID' };
    return this.usersService.findByTelegramId(telegramId);
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() body: { firstName?: string; lastName?: string; language?: string; phone?: string }) {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return { error: 'Missing telegram ID' };
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return { error: 'User not found' };
    return this.usersService.updateProfile(user.id, body);
  }

  /** Save name + phone before first order */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: { firstName?: string; phone?: string }) {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return { error: 'Missing telegram ID' };
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return { error: 'User not found' };
    return this.usersService.updateProfile(user.id, body);
  }
}
