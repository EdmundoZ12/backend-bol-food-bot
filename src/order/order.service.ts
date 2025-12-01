import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Driver, DriverStatus } from '../driver/entities/driver.entity';
import { CartService } from '../cart/cart.service';
import { UserService } from '../user/user.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { DistanceService } from './services/distance.service';
import { EarningsService } from './services/earnings.service';
import { DriverAssignmentService } from '../driver/services/driver-assignment.service';
import { FirebaseService } from '../config/firebase.service';

@Injectable()
export class OrderService {
  private rejectedDriversMap = new Map<string, string[]>();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly cartService: CartService,
    private readonly userService: UserService,
    private readonly distanceService: DistanceService,
    private readonly earningsService: EarningsService,
    private readonly driverAssignmentService: DriverAssignmentService,
    private readonly firebaseService: FirebaseService,
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
      | 'IN_TRANSIT'
      | 'DELIVERED'
      | 'CANCELLED',
  ): Promise<Order> {
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
      this.orderRepository.count({ where: { status: 'PENDING' } }),
      this.orderRepository.count({ where: { status: 'CONFIRMED' } }),
      this.orderRepository.count({ where: { status: 'ASSIGNED' } }),
      this.orderRepository.count({ where: { status: 'IN_TRANSIT' } }),
      this.orderRepository.count({ where: { status: 'DELIVERED' } }),
      this.orderRepository.count({ where: { status: 'CANCELLED' } }),
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

  /**
   * Driver acepta pedido
   */
  async acceptOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver'],
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw new BadRequestException('El pedido ya fue asignado');
    }

    // Asignar driver
    order.driver = { id: driverId } as Driver;
    order.status = 'ASSIGNED';
    order.assignedAt = new Date();

    await this.orderRepository.save(order);

    // Cambiar estado del driver a BUSY
    await this.orderRepository.manager.update(
      Driver,
      { id: driverId },
      { status: DriverStatus.BUSY },
    );

    console.log(`✅ Pedido ${orderId} aceptado por driver ${driverId}`);

    // Limpiar drivers rechazados de este pedido
    this.rejectedDriversMap.delete(orderId);

    return this.findOne(orderId);
  }

  /**
   * Driver rechaza pedido
   */
  async rejectOrder(orderId: string, driverId: string): Promise<any> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    console.log(`❌ Driver ${driverId} rechazó pedido ${orderId}`);

    // Agregar driver a la lista de rechazados
    const rejectedDrivers = this.rejectedDriversMap.get(orderId) || [];
    rejectedDrivers.push(driverId);
    this.rejectedDriversMap.set(orderId, rejectedDrivers);

    // Buscar siguiente driver más cercano
    await this.assignOrderToNearestDriver(order, rejectedDrivers);

    return { message: 'Pedido rechazado, buscando otro driver' };
  }

  /**
   * Driver actualiza estado del pedido
   */
  async updateDriverStatus(
    orderId: string,
    status: 'PICKING_UP' | 'PICKED_UP' | 'IN_TRANSIT',
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    order.status = status;

    if (status === 'PICKED_UP') {
      order.pickedUpAt = new Date();
    }

    return this.orderRepository.save(order);
  }

  /**
   * Asignar pedido al driver más cercano con notificación push
   */
  async assignOrderToNearestDriver(
    order: Order,
    excludeDriverIds: string[] = [],
  ): Promise<void> {
    // Calcular distancia y ganancia si no están calculadas
    if (!order.distanceKm || !order.driverEarnings) {
      const restaurantLat = parseFloat(
        process.env.RESTAURANT_LATITUDE || '-17.783777',
      );
      const restaurantLon = parseFloat(
        process.env.RESTAURANT_LONGITUDE || '-63.181997',
      );

      if (order.latitude && order.longitude) {
        const result = await this.distanceService.calculateDistance(
          restaurantLat,
          restaurantLon,
          order.latitude,
          order.longitude,
        );

        order.distanceKm = result.distanceKm;
        order.driverEarnings =
          this.earningsService.calculateDriverEarnings(result.distanceKm);

        console.log(
          `📍 Distancia calculada: ${result.distanceKm} km, Tiempo: ${result.durationMinutes} min, Ganancia: Bs. ${order.driverEarnings}`,
        );

        await this.orderRepository.save(order);
      }
    }

    const nearestDriver =
      await this.driverAssignmentService.findNearestAvailableDriver(
        excludeDriverIds,
      );

    if (!nearestDriver) {
      console.log('⚠️ No hay drivers disponibles');
      return;
    }

    if (!nearestDriver.appToken) {
      console.log('⚠️ Driver no tiene token FCM');
      return;
    }

    // Enviar notificación push
    try {
      await this.firebaseService.sendNotificationToDriver(
        nearestDriver.appToken,
        '🛵 Nuevo Pedido Disponible',
        `Ganancia: Bs. ${order.driverEarnings} - Distancia: ${order.distanceKm} km`,
        {
          orderId: order.id,
          earnings: order.driverEarnings?.toString() || '0',
          distance: order.distanceKm?.toString() || '0',
          type: 'NEW_ORDER',
        },
      );

      console.log(`📲 Notificación enviada a driver ${nearestDriver.id}`);
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }

    // Iniciar timeout de 120 segundos (2 minutos)
    const timeoutSeconds = parseInt(
      process.env.ORDER_ACCEPTANCE_TIMEOUT || '120',
    );

    setTimeout(async () => {
      const updatedOrder = await this.orderRepository.findOne({
        where: { id: order.id },
      });

      if (
        updatedOrder &&
        (updatedOrder.status === 'PENDING' ||
          updatedOrder.status === 'CONFIRMED')
      ) {
        console.log(
          `⏰ Timeout: Driver ${nearestDriver.id} no respondió en ${timeoutSeconds}s`,
        );
        // Buscar siguiente driver
        await this.assignOrderToNearestDriver(updatedOrder, [
          ...excludeDriverIds,
          nearestDriver.id,
        ]);
      }
    }, timeoutSeconds * 1000);
  }
}
