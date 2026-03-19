import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('api/v1/catalog')
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Get('categories')
  async getCategories() {
    return this.catalogService.getActiveCategories();
  }

  @Get('products')
  async getProducts(@Query('categoryId') categoryId?: string) {
    return this.catalogService.getActiveProducts(categoryId);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return this.catalogService.getProductById(id);
  }
}
