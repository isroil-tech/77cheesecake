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
  }) {
    const cart = await this.cartService.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Calculate totals and build order items
    let grandTotal = 0;
    const orderItems = cart.items.map((item: any) => {
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

      // Clear cart after order
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

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
