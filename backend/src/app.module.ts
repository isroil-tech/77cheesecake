import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { I18nModule } from './i18n/i18n.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { TelegramModule } from './telegram/telegram.module';
import { SettingsModule } from './settings/settings.module';
import { AuthController } from './auth/auth.controller';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000, 
      limit: 100, // 100 requests per IP per minute
    }]),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', 'public', 'admin'),
        serveRoot: '/admin',
        exclude: ['/api/{*path}'],
      },
      {
        rootPath: join(__dirname, '..', '..', 'public'),
        exclude: ['/api/{*path}', '/admin/{*path}'],
      },
    ),
    PrismaModule,
    I18nModule,
    UsersModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    TelegramModule,
    SettingsModule,
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
