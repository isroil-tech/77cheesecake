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
    extraPhone?: string;
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
          extraPhone: data.extraPhone,
          boxFee: 5000,
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

  async getAllOrders() {
    return this.prisma.order.findMany({
      include: {
        items: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
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

  async getAdminStats() {
    const allOrders = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= todayStart);

    // Revenue (exclude cancelled & pending_payment)
    const validStatuses = ['new', 'ready', 'delivered'];
    const totalRevenue = allOrders
      .filter(o => validStatuses.includes(o.status))
      .reduce((s, o) => s + Number(o.totalAmount) + Number(o.boxFee || 0), 0);
    const todayRevenue = todayOrders
      .filter(o => validStatuses.includes(o.status))
      .reduce((s, o) => s + Number(o.totalAmount) + Number(o.boxFee || 0), 0);

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const o of allOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    // Last 7 days revenue
    const last7Days: { date: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayOrders = allOrders.filter(o => {
        const t = new Date(o.createdAt);
        return t >= dayStart && t < dayEnd;
      });
      last7Days.push({
        date: dayStart.toISOString().slice(0, 10),
        revenue: dayOrders
          .filter(o => validStatuses.includes(o.status))
          .reduce((s, o) => s + Number(o.totalAmount), 0),
        count: dayOrders.length,
      });
    }

    // Top 5 products
    const productCount: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const o of allOrders) {
      for (const item of o.items) {
        const key = item.productNameUz;
        if (!productCount[key]) productCount[key] = { name: key, count: 0, revenue: 0 };
        productCount[key].count += item.quantity;
        productCount[key].revenue += Number(item.totalPrice);
      }
    }
    const topProducts = Object.values(productCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      totalRevenue,
      todayRevenue,
      statusCounts,
      last7Days,
      topProducts,
    };
  }
}
