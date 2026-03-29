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

  // ─── Admin: Seed Initial Menu ─────────────────────────────────────
  async seedInitial() {
    // 1. Deactivate old test categories/products to start fresh
    await this.prisma.category.updateMany({ data: { isActive: false } });
    await this.prisma.product.updateMany({ data: { isActive: false } });
    await this.prisma.productVariant.updateMany({ data: { isActive: false } });

    // 2. Create Categories
    const catClassic = await this.prisma.category.create({
      data: { nameUz: 'Classic', nameRu: 'Классические', sortOrder: 1 }
    });
    const catTami = await this.prisma.category.create({
      data: { nameUz: 'Ta\'mli', nameRu: 'С вкусами', sortOrder: 2 }
    });

    // 3. Create Classic Products
    const classicProducts = [
      { name: 'Classic cheesecake 23sm', price: 320000, type: 'whole' },
      { name: 'Classic cheesecake 23sm (bezatilgan)', price: 360000, type: 'whole' },
      { name: 'Classic cheesecake 12sm (bezatilgan)', price: 120000, type: 'whole' },
      { name: 'Classic cheesecake bo’lak (standard)', price: 55000, type: 'slice' },
      { name: 'Classic cheesecake bo’lak (mini)', price: 20000, type: 'slice' },
    ];

    for (let i = 0; i < classicProducts.length; i++) {
      const p = classicProducts[i];
      await this.prisma.product.create({
        data: {
          categoryId: catClassic.id,
          nameUz: p.name,
          nameRu: p.name,
          sortOrder: i + 1,
          variants: {
            create: [{
              nameUz: p.type === 'whole' ? 'Butun' : 'Bo\'lak',
              nameRu: p.type === 'whole' ? 'Целиком' : 'Кусочек',
              unitType: p.type,
              price: p.price,
              piecesPerUnit: p.type === 'whole' ? 8 : 1,
            }]
          }
        }
      });
    }

    // 4. Create Ta'mli Products
    const tamliProducts = [
      'Lotus', 'Dubai', 'Golubika', 'Mevali mix', 'Choco', 'Rafaello', 'Oreo', 'Mango', 'Malina'
    ];

    for (let i = 0; i < tamliProducts.length; i++) {
      const name = tamliProducts[i];
      await this.prisma.product.create({
        data: {
          categoryId: catTami.id,
          nameUz: name,
          nameRu: name,
          sortOrder: i + 1,
          variants: {
            create: [
              {
                nameUz: 'Butun', nameRu: 'Целиком',
                unitType: 'whole', price: 120000,
                piecesPerUnit: 8, sortOrder: 1,
              },
              {
                nameUz: 'Bo\'lak', nameRu: 'Кусочек',
                unitType: 'slice', price: 20000,
                piecesPerUnit: 1, sortOrder: 2,
              }
            ]
          }
        }
      });
    }

    return { success: true, message: 'Database seeded successfully' };
  }
}
