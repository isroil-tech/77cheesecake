import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { NotificationService } from './notification.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [TelegramService, NotificationService],
  exports: [TelegramService, NotificationService],
})
export class TelegramModule {}
