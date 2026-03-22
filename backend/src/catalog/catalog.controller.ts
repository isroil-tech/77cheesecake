import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Headers,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1')
export class CatalogController {
  constructor(
    private catalogService: CatalogService,
    private config: ConfigService,
  ) {}

  private checkAdmin(telegramId: string) {
    const adminIds = (this.config.get<string>('ADMIN_TELEGRAM_IDS') || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    if (!adminIds.includes(telegramId)) throw new Error('Unauthorized');
  }

  // ─── Public ──────────────────────────────────────────────────────
  @Get('catalog/categories')
  async getCategories() {
    return this.catalogService.getActiveCategories();
  }

  @Get('catalog/products')
  async getProducts(@Query('categoryId') categoryId?: string) {
    return this.catalogService.getActiveProducts(categoryId);
  }

  @Get('catalog/products/:id')
  async getProduct(@Param('id') id: string) {
    return this.catalogService.getProductById(id);
  }

  // ─── Admin: Categories ───────────────────────────────────────────
  @Get('admin/catalog/categories')
  async adminGetCategories(@Headers('x-telegram-id') tgId: string) {
    this.checkAdmin(tgId);
    return this.catalogService.getAllCategories();
  }

  @Post('admin/catalog/categories')
  async adminCreateCategory(
    @Headers('x-telegram-id') tgId: string,
    @Body() body: { nameUz: string; nameRu: string; sortOrder?: number },
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.createCategory(body);
  }

  // ─── Admin: Products ─────────────────────────────────────────────
  @Get('admin/catalog/products')
  async adminGetProducts(@Headers('x-telegram-id') tgId: string) {
    this.checkAdmin(tgId);
    return this.catalogService.getAllProducts();
  }

  @Post('admin/catalog/products')
  async adminCreateProduct(
    @Headers('x-telegram-id') tgId: string,
    @Body() body: {
      categoryId: string;
      nameUz: string;
      nameRu: string;
      descriptionUz?: string;
      descriptionRu?: string;
      imageUrl?: string;
      sortOrder?: number;
    },
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.createProduct(body);
  }

  @Patch('admin/catalog/products/:id')
  async adminUpdateProduct(
    @Headers('x-telegram-id') tgId: string,
    @Param('id') id: string,
    @Body() body: {
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
    this.checkAdmin(tgId);
    return this.catalogService.updateProduct(id, body);
  }

  @Delete('admin/catalog/products/:id')
  async adminDeleteProduct(
    @Headers('x-telegram-id') tgId: string,
    @Param('id') id: string,
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.deleteProduct(id);
  }

  // ─── Admin: Variants ─────────────────────────────────────────────
  @Post('admin/catalog/products/:id/variants')
  async adminCreateVariant(
    @Headers('x-telegram-id') tgId: string,
    @Param('id') productId: string,
    @Body() body: {
      nameUz: string;
      nameRu: string;
      unitType: string;
      price: number;
      piecesPerUnit?: number;
      sortOrder?: number;
    },
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.createVariant({ ...body, productId });
  }

  @Patch('admin/catalog/variants/:id')
  async adminUpdateVariant(
    @Headers('x-telegram-id') tgId: string,
    @Param('id') id: string,
    @Body() body: {
      nameUz?: string;
      nameRu?: string;
      unitType?: string;
      price?: number;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.updateVariant(id, body);
  }

  @Delete('admin/catalog/variants/:id')
  async adminDeleteVariant(
    @Headers('x-telegram-id') tgId: string,
    @Param('id') id: string,
  ) {
    this.checkAdmin(tgId);
    return this.catalogService.deleteVariant(id);
  }
}
