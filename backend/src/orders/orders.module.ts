import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { UsersModule } from '../users/users.module';
import { CartModule } from '../cart/cart.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [UsersModule, CartModule, TelegramModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
