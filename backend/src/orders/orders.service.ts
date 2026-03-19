import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
  ) {}

  async createOrder(userId: string, data: {
    deliveryType: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    comment?: string;
    items?: Array<{
      productId: string;
      name: { uz: string; ru: string };
      format: string;
      quantity: number;
      pricePerUnit: number;
    }>;
  }) {
    let orderItems: any[] = [];
    let grandTotal = 0;

    // Try server-side cart first
    const cart = await this.cartService.getOrCreateCart(userId);
    if (cart.items && cart.items.length > 0) {
      // Use server-side cart
      orderItems = cart.items.map((item: any) => {
        const price = Number(item.productVariant.price);
        const lineTotal = price * item.quantity;
        grandTotal += lineTotal;

        return {
          productVariantId: item.productVariant.id,
          productNameUz: item.productVariant.product.nameUz,
          productNameRu: item.productVariant.product.nameRu,
          variantNameUz: item.productVariant.nameUz,
          variantNameRu: item.productVariant.nameRu,
          unitType: item.productVariant.unitType,
          quantity: item.quantity,
          unitPrice: price,
          totalPrice: lineTotal,
        };
      });
    } else if (data.items && data.items.length > 0) {
      // Fallback: use items from request body (Lovable local cart)
      orderItems = data.items.map((item) => {
        const lineTotal = item.pricePerUnit * item.quantity;
        grandTotal += lineTotal;
        return {
          productNameUz: item.name?.uz || item.productId,
          productNameRu: item.name?.ru || item.productId,
          variantNameUz: item.format || '',
          variantNameRu: item.format || '',
          unitType: item.format || 'piece',
          quantity: item.quantity,
          unitPrice: item.pricePerUnit,
          totalPrice: lineTotal,
        };
      });
    } else {
      throw new BadRequestException('Cart is empty');
    }

    // Create order in transaction — status = pending_payment
    const order = await this.prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          status: 'pending_payment',
          deliveryType: data.deliveryType,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          comment: data.comment,
          totalAmount: grandTotal,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: { productVariant: { include: { product: true } } },
          },
          user: true,
        },
      });

      // Clear server cart if used
      if (cart.items && cart.items.length > 0) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return newOrder;
    });

    return order;
  }

  async confirmPayment(orderId: string, paymentType: string, paymentScreenshot?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    if (order.status !== 'pending_payment') {
      throw new BadRequestException('Order already paid');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'new',
        paymentType,
        paymentScreenshot: paymentScreenshot || null,
      },
      include: {
        items: {
          include: { productVariant: { include: { product: true } } },
        },
        user: true,
      },
    });
  }

  async getOrdersByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { productVariant: { include: { product: true } } },
        },
        user: true,
      },
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { user: true },
    });
  }
}
