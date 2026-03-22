import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // ─── Public endpoints ────────────────────────────────────────────
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
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        category: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getProductById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    });
  }

  // ─── Admin: Categories ───────────────────────────────────────────
  async getAllCategories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createCategory(data: { nameUz: string; nameRu: string; sortOrder?: number }) {
    return this.prisma.category.create({ data });
  }

  // ─── Admin: Products ─────────────────────────────────────────────
  async getAllProducts() {
    return this.prisma.product.findMany({
      include: {
        variants: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createProduct(data: {
    categoryId: string;
    nameUz: string;
    nameRu: string;
    descriptionUz?: string;
    descriptionRu?: string;
    imageUrl?: string;
    sortOrder?: number;
  }) {
    return this.prisma.product.create({
      data,
      include: { variants: true, category: true },
    });
  }

  async updateProduct(
    id: string,
    data: {
      nameUz?: string;
      nameRu?: string;
      descriptionUz?: string;
      descriptionRu?: string;
      imageUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
      categoryId?: string;
    },
  ) {
    return this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true, category: true },
    });
  }

  async deleteProduct(id: string) {
    // Soft delete — deactivate
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Admin: Variants ─────────────────────────────────────────────
  async createVariant(data: {
    productId: string;
    nameUz: string;
    nameRu: string;
    unitType: string;
    price: number;
    piecesPerUnit?: number;
    sortOrder?: number;
  }) {
    return this.prisma.productVariant.create({ data });
  }

  async updateVariant(
    id: string,
    data: {
      nameUz?: string;
      nameRu?: string;
      unitType?: string;
      price?: number;
      piecesPerUnit?: number;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.productVariant.update({ where: { id }, data });
  }

  async deleteVariant(id: string) {
    return this.prisma.productVariant.delete({ where: { id } }).catch(() =>
      this.prisma.productVariant.update({ where: { id }, data: { isActive: false } }),
    );
  }
}
