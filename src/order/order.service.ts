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
import { Inject, forwardRef } from '@nestjs/common';
import { DriverService } from '../driver/driver.service';
import { DriverStatus } from '../driver/entities/driver.entity';
import { OrderAssignmentService } from '../common/services/order-assignment.service';
import { TelegramApiUtil } from '../telegram-bot/utils/telegram-api.util';

@Injectable()
export class OrderService {
  constructor(
    @Inject(forwardRef(() => DriverService))
    private readonly driverService: DriverService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly cartService: CartService,
    private readonly userService: UserService,
    private readonly orderAssignmentService: OrderAssignmentService,
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
    order.status = OrderStatus.PENDING;
    order.paymentMethod = paymentMethod
      ? PaymentMethod[paymentMethod as keyof typeof PaymentMethod]
      : null;
    order.paymentStatus = PaymentStatus.PENDING;
    order.notes = notes || null;
    order.phone = user.phone || null;

    // Usar referencia parcial para evitar actualizaciones no deseadas en User
    order.user = { telegramId: user.telegramId } as any;

    // Nuevos campos
    if (createOrderDto.latitude && createOrderDto.longitude) {
      order.latitude = createOrderDto.latitude;
      order.longitude = createOrderDto.longitude;
    }

    if (createOrderDto.deliveryFee) {
      order.deliveryFee = createOrderDto.deliveryFee;
      // Asignar ganancia del conductor igual al delivery fee
      order.driverEarnings = createOrderDto.deliveryFee;

      // Sumar delivery al total y redondear a 2 decimales
      const totalWithDelivery = totalAmount + createOrderDto.deliveryFee;
      order.totalAmount = Math.round(totalWithDelivery * 100) / 100;
    } else {
      order.totalAmount = Math.round(totalAmount * 100) / 100;
    }

    await this.orderRepository.save(order);

    // Crear order items desde cart items
    const orderItems = cart.cartItems.map((cartItem) => {
      return this.orderItemRepository.create({
        order: { id: order.id } as any, // Referencia parcial
        product: { id: cartItem.product.id } as any, // Referencia parcial
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

    const savedOrder = await this.orderRepository.save(order);

    return savedOrder;
  }

  /**
   * Iniciar asignación de conductor (después de tener ubicación)
   */
  async startAssignment(orderId: string): Promise<void> {
    try {
      console.log(`🚀 Iniciando asignación para orden ${orderId}`);
      await this.orderAssignmentService.assignOrder(orderId);
    } catch (error) {
      console.error('Error al iniciar asignación:', error);
    }
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
   * Obtener resumen de orden (Alias para findOne por compatibilidad)
   */
  async getOrderSummary(orderId: string): Promise<Order> {
    return this.findOne(orderId);
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
   * Obtener pedido activo de un conductor (ASSIGNED, PICKING_UP, IN_TRANSIT, AT_PLACE)
   */
  async findActiveByDriver(driverId: string): Promise<Order | null> {
    const order = await this.orderRepository.findOne({
      where: [
        { driver: { id: driverId }, status: OrderStatus.ASSIGNED },
        { driver: { id: driverId }, status: OrderStatus.PICKING_UP },
        { driver: { id: driverId }, status: OrderStatus.IN_TRANSIT },
        { driver: { id: driverId }, status: OrderStatus.AT_PLACE },
      ],
      relations: ['orderItems', 'orderItems.product', 'user', 'driver'],
      order: { createdAt: 'DESC' },
    });

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    // Usar any para evitar conflictos de tipos estrictos en el merge si el DTO no coincide exactamente
    this.orderRepository.merge(order, updateOrderDto as any);
    return this.orderRepository.save(order);
  }

  async cancel(orderId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }

    order.status = OrderStatus.CANCELLED;
    // order.cancellationReason = reason; // Si agregas este campo a la entidad

    return this.orderRepository.save(order);
  }

  async markAsDelivered(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    order.status = OrderStatus.DELIVERED;
    order.paymentStatus = PaymentStatus.COMPLETED;
    return this.orderRepository.save(order);
  }

  async getStats() {
    const total = await this.orderRepository.count();
    const pending = await this.orderRepository.count({ where: { status: OrderStatus.PENDING } });
    const confirmed = await this.orderRepository.count({ where: { status: OrderStatus.CONFIRMED } });
    const assigned = await this.orderRepository.count({ where: { status: OrderStatus.ASSIGNED } });
    const inTransit = await this.orderRepository.count({ where: { status: OrderStatus.IN_TRANSIT } });
    const delivered = await this.orderRepository.count({ where: { status: OrderStatus.DELIVERED } });
    const cancelled = await this.orderRepository.count({ where: { status: OrderStatus.CANCELLED } });

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

  async acceptOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    console.log(`[acceptOrder] Attempting to accept order ${orderId} by driver ${driverId}`);
    console.log(`[acceptOrder] Current Status: ${order.status}`);
    console.log(`[acceptOrder] Current Driver: ${order.driver?.id}`);

    // Si la orden ya está asignada a este conductor, permitimos continuar
    if (order.status === OrderStatus.ASSIGNED && order.driver?.id === driverId) {
      console.log('[acceptOrder] Order already assigned to this driver. Allowing re-acceptance.');
      return order;
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      console.error(`[acceptOrder] Failed: Status is ${order.status}, expected CONFIRMED. Driver mismatch? ${order.driver?.id} !== ${driverId}`);
      throw new BadRequestException('Order is not available for acceptance');
    }

    order.driver = { id: driverId } as any;
    order.status = OrderStatus.ASSIGNED;

    return this.orderRepository.save(order);
  }

  async arrivedAtRestaurant(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Order does not belong to this driver');
    }

    order.status = OrderStatus.PICKING_UP;
    return this.orderRepository.save(order);
  }

  // Alias para compatibilidad con controlador
  async confirmPickup(orderId: string, driverId: string): Promise<Order> {
    return this.arrivedAtRestaurant(orderId, driverId);
  }

  async startDelivery(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Order does not belong to this driver');
    }

    order.status = OrderStatus.IN_TRANSIT;
    return this.orderRepository.save(order);
  }

  async arrivedAtCustomer(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Order does not belong to this driver');
    }

    order.status = OrderStatus.AT_PLACE;
    return this.orderRepository.save(order);
  }

  // Alias para compatibilidad con controlador
  async atCustomerDoor(orderId: string, driverId: string): Promise<Order> {
    return this.arrivedAtCustomer(orderId, driverId);
  }

  async completeDelivery(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Order does not belong to this driver');
    }

    order.status = OrderStatus.DELIVERED;
    order.paymentStatus = PaymentStatus.COMPLETED;

    return this.orderRepository.save(order);
  }

  // Alias para compatibilidad con controlador
  async confirmDelivery(orderId: string, driverId: string): Promise<Order> {
    return this.completeDelivery(orderId, driverId);
  }

  async rejectOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    // Lógica para rechazar (quizás reasignar o marcar como rechazado por este driver)
    // Por ahora solo desasignamos
    if (order.driver?.id === driverId) {
      order.driver = null;
      order.status = OrderStatus.CONFIRMED; // Volver a poner disponible
    }

    return this.orderRepository.save(order);
  }
}
