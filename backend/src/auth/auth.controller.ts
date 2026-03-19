import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private usersService: UsersService) {}

  @Post('telegram')
  async authTelegram(@Body() body: { telegramId: string; firstName?: string; lastName?: string }) {
    if (!body.telegramId) {
      return { error: 'telegramId is required' };
    }

    let user = await this.usersService.findByTelegramId(body.telegramId);

    if (!user) {
      user = await this.usersService.createOrUpdate(body.telegramId, {
        firstName: body.firstName,
        lastName: body.lastName,
      });
    }

    return { user };
  }
}
