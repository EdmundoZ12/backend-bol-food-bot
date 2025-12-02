import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { UserService } from '../user/user.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { DistanceService } from '../common/services/distance.service';
import { PricingService } from '../common/services/pricing.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly cartService: CartService,
    private readonly userService: UserService,
    private readonly distanceService: DistanceService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Crear orden desde el carrito
   */
  async createFromCart(createOrderDto: CreateOrderDto): Promise<Order> {
    const { userId, notes, paymentMethod } = createOrderDto;

    // Validar que el carrito no esté vacío
    const isEmpty = await this.cartService.isEmpty(userId);
    if (isEmpty) {
      throw new BadRequestException('Cart is empty');
    }

    // Validar carrito
    const validation = await this.cartService.validateCart(userId);
    if (!validation.valid) {
      throw new BadRequestException(
        `Cart validation failed: ${validation.errors.join(', ')}`,
      );
    }

    // Obtener carrito con items
    const cart = await this.cartService.getCartWithItems(userId);

    // Obtener usuario
    const user = await this.userService.findByTelegramId(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calcular total
    const totalAmount = await this.cartService.calculateTotal(userId);

    // Crear orden
    const order = this.orderRepository.create();
    order.totalAmount = totalAmount;
    order.status = OrderStatus.PENDING;
    order.paymentMethod = paymentMethod
      ? PaymentMethod[paymentMethod as keyof typeof PaymentMethod]
      : null;
    order.paymentStatus = PaymentStatus.PENDING;
    order.notes = notes || null;
    order.phone = user.phone || null;
    order.user = user;

    await this.orderRepository.save(order);

    // Crear order items desde cart items
    const orderItems = cart.cartItems.map((cartItem) => {
      return this.orderItemRepository.create({
        order,
        product: cartItem.product,
        productName: cartItem.product.name,
        quantity: cartItem.quantity,
        unitPrice: cartItem.unitPrice,
        subTotal: cartItem.subtotal,
      });
    });

    await this.orderItemRepository.save(orderItems);

    // Limpiar carrito
    await this.cartService.clearCart(userId);

    // Retornar orden completa
    return this.findOne(order.id);
  }

  /**
   * Agregar notas a la orden
   */
  async addNotes(orderId: string, notes: string): Promise<Order> {
    const order = await this.findOne(orderId);
    order.notes = notes;
    return this.orderRepository.save(order);
  }

  /**
   * Establecer método de pago
   */
  async setPaymentMethod(
    orderId: string,
    method: 'CASH' | 'QR',
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    order.paymentMethod = PaymentMethod[method];
    return this.orderRepository.save(order);
  }

  /**
   * Confirmar pago (cuando el usuario confirma que pagó el QR o elige efectivo)
   */
  async confirmPayment(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.paymentMethod === PaymentMethod.CASH) {
      // Para efectivo, el pago queda pendiente hasta la entrega
      order.paymentStatus = PaymentStatus.PENDING;
      order.status = OrderStatus.CONFIRMED;
    } else if (order.paymentMethod === PaymentMethod.QR) {
      // Para QR, asumimos que el usuario confirma que pagó
      order.paymentStatus = PaymentStatus.COMPLETED;
      order.status = OrderStatus.CONFIRMED;
    }

    return this.orderRepository.save(order);
  }

  /**
   * Establecer ubicación del pedido Y CALCULAR DELIVERY FEE
   */
  async setLocation(
    orderId: string,
    latitude: number,
    longitude: number,
    address?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    order.latitude = latitude;
    order.longitude = longitude;

    if (address) {
      order.deliveryAddress = address;
    }

    // NUEVO: Calcular y guardar delivery fee automáticamente
    const distance = this.distanceService.calculateDistanceFromRestaurant(
      latitude,
      longitude,
    );
    order.deliveryDistance = distance;
    order.deliveryFee = this.pricingService.calculateDeliveryFee(distance);
    order.driverEarnings =
      this.pricingService.calculateDriverEarnings(distance);

    return this.orderRepository.save(order);
  }

  /**
   * NUEVO: Calcular delivery fee sin crear orden
   * Útil para mostrar el costo al cliente ANTES de confirmar
   */
  async calculateDeliveryFee(
    latitude: number,
    longitude: number,
  ): Promise<{
    distance: number;
    deliveryFee: number;
    driverEarnings: number;
    estimatedTime: number;
    priceBreakdown: {
      basePrice: number;
      distancePrice: number;
      total: number;
    };
  }> {
    const distance = this.distanceService.calculateDistanceFromRestaurant(
      latitude,
      longitude,
    );
    const deliveryFee = this.pricingService.calculateDeliveryFee(distance);
    const driverEarnings =
      this.pricingService.calculateDriverEarnings(distance);
    const priceBreakdown = this.pricingService.getPriceBreakdown(distance);

    // Estimación: ~8 minutos por km (incluye tiempo de preparación base)
    const estimatedTime = Math.max(15, Math.round(distance * 8));

    return {
      distance: Math.round(distance * 100) / 100,
      deliveryFee,
      driverEarnings,
      estimatedTime,
      priceBreakdown,
    };
  }

  /**
   * Calcular delivery fee de forma síncrona (para uso interno)
   */
  calculateDeliveryFeeByLocation(
    latitude: number,
    longitude: number,
  ): {
    distance: number;
    deliveryFee: number;
    estimatedTime: number;
  } {
    const distance = this.distanceService.calculateDistanceFromRestaurant(
      latitude,
      longitude,
    );
    const deliveryFee = this.pricingService.calculateDeliveryFee(distance);
    const estimatedTime = Math.max(15, Math.round(distance * 8));

    return {
      distance: Math.round(distance * 100) / 100,
      deliveryFee,
      estimatedTime,
    };
  }

  /**
   * Actualizar estado de la orden
   */
  async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(orderId);
    order.status = status;
    return this.orderRepository.save(order);
  }

  /**
   * Asignar conductor a la orden
   */
  async assignDriver(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    order.driver = { id: driverId } as any;
    order.status = OrderStatus.ASSIGNED;

    return this.orderRepository.save(order);
  }

  /**
   * Obtener orden con todos sus detalles
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'orderItems',
        'orderItems.product',
        'orderItems.product.images',
        'user',
        'driver',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Obtener todas las órdenes de un usuario
   */
  async findByUser(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { user: { telegramId: userId } },
      relations: ['orderItems', 'orderItems.product'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtener órdenes por estado
   */
  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return this.orderRepository.find({
      where: { status },
      relations: ['orderItems', 'user', 'driver'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtener todas las órdenes (admin)
   */
  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['orderItems', 'user', 'driver'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtener órdenes pendientes de asignación
   */
  async findPendingAssignment(): Promise<Order[]> {
    return this.orderRepository.find({
      where: { status: OrderStatus.CONFIRMED },
      relations: ['orderItems', 'user'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Obtener órdenes de un conductor
   */
  async findByDriver(driverId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { driver: { id: driverId } },
      relations: ['orderItems', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Actualizar orden
   */
  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, updateOrderDto);
    return this.orderRepository.save(order);
  }

  /**
   * Cancelar orden
   */
  async cancel(orderId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered order');
    }

    order.status = OrderStatus.CANCELLED;
    if (reason) {
      order.notes = `${
        order.notes || ''
      }\nCancellation reason: ${reason}`.trim();
    }

    return this.orderRepository.save(order);
  }

  /**
   * Marcar orden como entregada
   */
  async markAsDelivered(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    order.status = OrderStatus.DELIVERED;

    // Si es pago en efectivo, marcar como completado al entregar
    if (order.paymentMethod === PaymentMethod.CASH) {
      order.paymentStatus = PaymentStatus.COMPLETED;
    }

    return this.orderRepository.save(order);
  }

  /**
   * Obtener resumen de la orden (para el bot) - INCLUYE DELIVERY FEE
   */
  async getOrderSummary(orderId: string): Promise<{
    orderId: string;
    status: string;
    paymentMethod: string | null;
    paymentStatus: string;
    totalAmount: number;
    deliveryFee: number | null;
    deliveryDistance: number | null;
    totalWithDelivery: number;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    deliveryAddress?: string | null;
    notes?: string | null;
    phone?: string | null;
  }> {
    const order = await this.findOne(orderId);
    const deliveryFee = order.deliveryFee || 0;
    const totalWithDelivery = order.totalAmount + deliveryFee;

    return {
      orderId: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliveryFee,
      deliveryDistance: order.deliveryDistance,
      totalWithDelivery,
      items: order.orderItems.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subTotal,
      })),
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      phone: order.phone,
    };
  }

  /**
   * Obtener estadísticas de órdenes (opcional, para dashboard)
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    assigned: number;
    inTransit: number;
    delivered: number;
    cancelled: number;
  }> {
    const [
      total,
      pending,
      confirmed,
      assigned,
      inTransit,
      delivered,
      cancelled,
    ] = await Promise.all([
      this.orderRepository.count(),
      this.orderRepository.count({ where: { status: OrderStatus.PENDING } }),
      this.orderRepository.count({ where: { status: OrderStatus.CONFIRMED } }),
      this.orderRepository.count({ where: { status: OrderStatus.ASSIGNED } }),
      this.orderRepository.count({ where: { status: OrderStatus.IN_TRANSIT } }),
      this.orderRepository.count({ where: { status: OrderStatus.DELIVERED } }),
      this.orderRepository.count({ where: { status: OrderStatus.CANCELLED } }),
    ]);

    return {
      total,
      pending,
      confirmed,
      assigned,
      inTransit,
      delivered,
      cancelled,
    };
  }
}
