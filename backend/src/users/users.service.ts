import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createOrUpdate(telegramId: string, data: {
    phone?: string;
    firstName?: string;
    lastName?: string;
    language?: string;
  }) {
    return this.prisma.user.upsert({
      where: { telegramId },
      create: { telegramId, ...data },
      update: data,
    });
  }

  async updateLanguage(telegramId: string, language: string) {
    return this.prisma.user.update({
      where: { telegramId },
      data: { language },
    });
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    language?: string;
  }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
