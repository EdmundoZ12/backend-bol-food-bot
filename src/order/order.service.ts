import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { UserService } from '../user/user.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ConfigService } from '@nestjs/config';
import { calculateDistance } from '../common/utils/distance.util';

import { DriverService } from '../driver/driver.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramApiUtil } from '../telegram-bot/utils/telegram-api.util';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly cartService: CartService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DriverService))
    private readonly driverService: DriverService,
    private readonly notificationService: NotificationService,
    private readonly telegramApi: TelegramApiUtil,
  ) { }

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
    order.status = 'PENDING';
    order.paymentMethod = paymentMethod || null;
    order.paymentStatus = 'PENDING';
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
    order.paymentMethod = method;
    return this.orderRepository.save(order);
  }

  /**
   * Confirmar pago (cuando el usuario confirma que pagó el QR o elige efectivo)
   */
  async confirmPayment(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.paymentMethod === 'CASH') {
      // Para efectivo, el pago queda pendiente hasta la entrega
      order.paymentStatus = 'PENDING';
      order.status = 'CONFIRMED';
    } else if (order.paymentMethod === 'QR') {
      // Para QR, asumimos que el usuario confirma que pagó
      order.paymentStatus = 'COMPLETED';
      order.status = 'CONFIRMED';
    }

    return this.orderRepository.save(order);
  }

  /**
   * Establecer ubicación del pedido
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

    return this.orderRepository.save(order);
  }

  /**
   * Actualizar estado de la orden
   */
  async updateStatus(
    orderId: string,
    status:
      | 'PENDING'
      | 'CONFIRMED'
      | 'ASSIGNED'
      | 'ACCEPTED'
      | 'PICKING_UP'
      | 'PICKED_UP'
      | 'IN_TRANSIT'
      | 'DELIVERED'
      | 'CANCELLED',
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);

    // Notificar al usuario por Telegram
    if (order.user?.telegramId) {
      let message = '';
      switch (status) {
        case 'ACCEPTED':
          message = `👨‍🍳 Tu pedido #${order.id.slice(0, 8)} ha sido aceptado por un conductor.`;
          break;
        case 'PICKING_UP':
          message = `🛵 El conductor está en camino al restaurante.`;
          break;
        case 'PICKED_UP':
          message = `🥡 El conductor ha recogido tu pedido y va en camino.`;
          break;
        case 'IN_TRANSIT':
          message = `🚀 Tu pedido está en camino a tu ubicación.`;
          break;
        case 'DELIVERED':
          message = `✅ Tu pedido ha sido entregado. ¡Buen provecho!`;
          break;
        case 'CANCELLED':
          message = `❌ Tu pedido ha sido cancelado.`;
          break;
      }

      if (message) {
        await this.telegramApi.sendMessage(Number(order.user.telegramId), message);
      }
    }

    return updatedOrder;
  }

  /**
   * Asignar conductor a la orden
   */
  async assignDriver(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    order.driver = { id: driverId } as any;
    order.status = 'ASSIGNED';

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
  async findByStatus(status: string): Promise<Order[]> {
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
      where: { status: 'CONFIRMED' },
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

    if (order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot cancel a delivered order');
    }

    order.status = 'CANCELLED';
    if (reason) {
      order.notes = `${order.notes || ''
        }\nCancellation reason: ${reason}`.trim();
    }

    return this.orderRepository.save(order);
  }

  /**
   * Marcar orden como entregada
   */
  async markAsDelivered(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    order.status = 'DELIVERED';

    // Si es pago en efectivo, marcar como completado al entregar
    if (order.paymentMethod === 'CASH') {
      order.paymentStatus = 'COMPLETED';
    }

    return this.orderRepository.save(order);
  }

  /**
   * Obtener resumen de la orden (para el bot)
   */
  async getOrderSummary(orderId: string): Promise<{
    orderId: string;
    status: string;
    paymentMethod: string | null; // ← Cambiar aquí
    paymentStatus: string;
    totalAmount: number;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    deliveryAddress?: string | null; // ← Cambiar aquí
    notes?: string | null; // ← Cambiar aquí
    phone?: string | null; // ← Cambiar aquí
  }> {
    const order = await this.findOne(orderId);

    return {
      orderId: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
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
    accepted: number;
    pickingUp: number;
    pickedUp: number;
  }> {
    const [
      total,
      pending,
      confirmed,
      assigned,
      inTransit,
      delivered,
      cancelled,
      accepted,
      pickingUp,
      pickedUp,
    ] = await Promise.all([
      this.orderRepository.count(),
      this.orderRepository.count({ where: { status: 'PENDING' } }),
      this.orderRepository.count({ where: { status: 'CONFIRMED' } }),
      this.orderRepository.count({ where: { status: 'ASSIGNED' } }),
      this.orderRepository.count({ where: { status: 'IN_TRANSIT' } }),
      this.orderRepository.count({ where: { status: 'DELIVERED' } }),
      this.orderRepository.count({ where: { status: 'CANCELLED' } }),
      this.orderRepository.count({ where: { status: 'ACCEPTED' } }),
      this.orderRepository.count({ where: { status: 'PICKING_UP' } }),
      this.orderRepository.count({ where: { status: 'PICKED_UP' } }),
    ]);

    return {
      total,
      pending,
      confirmed,
      assigned,
      inTransit,
      delivered,
      cancelled,
      accepted,
      pickingUp,
      pickedUp,
    };
  }

  /**
   * Calcular ganancia del conductor
   */
  calculateDriverEarnings(distanceKm: number): number {
    const basePrice = this.configService.get<number>('DELIVERY_BASE_PRICE', 15);
    const pricePerKm = this.configService.get<number>(
      'DELIVERY_PRICE_PER_KM',
      3,
    );
    return basePrice + distanceKm * pricePerKm;
  }

  /**
   * Asignar orden al conductor más cercano
   */
  async assignToNearestDriver(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    const restaurantLat = this.configService.get<number>('RESTAURANT_LATITUDE');
    const restaurantLon = this.configService.get<number>('RESTAURANT_LONGITUDE');

    // Buscar conductor más cercano excluyendo los rechazados
    const driver = await this.driverService.findNearestAvailableDriver(
      restaurantLat || 0,
      restaurantLon || 0,
      order.rejectedDriverIds || [],
    );

    if (!driver) {
      // No hay conductores disponibles
      // Podríamos notificar al admin o dejar en estado CONFIRMED
      console.log('No drivers available for order', orderId);
      return order;
    }

    // Calcular distancia y ganancia
    // Asumimos que la distancia es desde el restaurante hasta el cliente
    // Si no hay ubicación del cliente, usamos 0 o un valor por defecto
    let distance = 0;
    if (order.latitude && order.longitude) {
      distance = calculateDistance(
        restaurantLat || 0,
        restaurantLon || 0,
        order.latitude,
        order.longitude,
      );
    }

    const earnings = this.calculateDriverEarnings(distance);

    // Actualizar orden
    order.driver = driver;
    order.status = 'ASSIGNED';
    order.driverEarnings = earnings;

    await this.orderRepository.save(order);

    // Enviar notificación al conductor
    if (driver.appToken) {
      await this.notificationService.sendPushNotification(
        driver.appToken,
        'Nuevo Pedido 🍔',
        `Ganancia estimada: Bs. ${earnings.toFixed(2)}. Distancia: ${distance.toFixed(1)} km`,
        {
          type: 'NEW_ORDER',
          orderId: order.id,
        },
      );
    }

    return order;
  }
  /**
   * Rechazar pedido (Driver)
   */
  async rejectOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    // Agregar a rechazados
    if (!order.rejectedDriverIds) {
      order.rejectedDriverIds = [];
    }
    // Asegurarse de no duplicar
    if (!order.rejectedDriverIds.includes(driverId)) {
      order.rejectedDriverIds.push(driverId);
    }

    // Quitar driver actual
    order.driver = null;
    order.status = 'CONFIRMED'; // Volver a estado anterior para re-asignar

    await this.orderRepository.save(order);

    // Buscar siguiente driver inmediatamente
    return this.assignToNearestDriver(orderId);
  }

  /**
   * Cron Job: Verificar pedidos asignados que expiraron (20 segundos)
   * Se ejecuta cada 10 segundos
   */
  @Cron('*/10 * * * * *')
  async handleOrderTimeout() {
    // Buscar órdenes en estado ASSIGNED que llevan más de 20 segundos
    const timeoutThreshold = new Date(Date.now() - 20 * 1000);

    const staleOrders = await this.orderRepository.find({
      where: {
        status: 'ASSIGNED',
        updatedAt: LessThan(timeoutThreshold),
      },
      relations: ['driver'],
    });

    for (const order of staleOrders) {
      if (order.driver) {
        console.log(`Order ${order.id} timed out for driver ${order.driver.id}`);
        await this.rejectOrder(order.id, order.driver.id);
      }
    }
  }
}
