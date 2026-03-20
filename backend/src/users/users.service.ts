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
    username?: string;
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
    phone?: string;
  }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBotStats() {
    const allUsers = await this.prisma.user.findMany();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const withPhone = allUsers.filter(u => u.phone).length;
    const uzUsers = allUsers.filter(u => u.language === 'uz').length;
    const ruUsers = allUsers.filter(u => u.language === 'ru').length;
    const recentUsers = allUsers.filter(u => new Date(u.createdAt) >= thirtyDaysAgo).length;

    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      last7Days.push({
        date: dayStart.toISOString().slice(0, 10),
        count: allUsers.filter(u => {
          const t = new Date(u.createdAt);
          return t >= dayStart && t < dayEnd;
        }).length,
      });
    }

    return {
      totalUsers: allUsers.length,
      withPhone,
      withoutPhone: allUsers.length - withPhone,
      uzUsers,
      ruUsers,
      noLang: allUsers.filter(u => !u.language).length,
      newLast30Days: recentUsers,
      last7Days,
    };
  }
}
