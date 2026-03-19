import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async getActiveCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getActiveProducts(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.product.findMany({
      where,
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getProductById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
      },
    });
  }
}
