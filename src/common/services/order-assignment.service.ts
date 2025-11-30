import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus } from '../../order/entities/order.entity';
import { Driver, DriverStatus } from '../../driver/entities/driver.entity';
import { FirebaseService } from './firebase.service';
import { GoogleMapsService } from './google-maps.service';
import { PricingService } from './pricing.service';

export interface AssignmentResult {
  success: boolean;
  message: string;
  order?: Order;
  driver?: Driver;
  estimatedTime?: number;
}

@Injectable()
export class OrderAssignmentService {
  private readonly logger = new Logger(OrderAssignmentService.name);
  private readonly acceptTimeout: number;

  // Almacenar timeouts activos para poder cancelarlos
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Almacenar drivers que rechazaron cada orden
  private rejectedDrivers: Map<string, string[]> = new Map();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly firebaseService: FirebaseService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly pricingService: PricingService,
    private readonly configService: ConfigService,
  ) {
    this.acceptTimeout = parseInt(
      this.configService.get<string>('DRIVER_ACCEPT_TIMEOUT') || '30000',
    );
  }

  /**
   * Iniciar proceso de asignación de pedido
   */
  async assignOrder(orderId: string): Promise<AssignmentResult> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['orderItems', 'user'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Order must be CONFIRMED to assign. Current status: ${order.status}`,
      );
    }

    // Calcular distancia y costo de delivery
    if (order.latitude && order.longitude) {
      const distanceResult =
        await this.googleMapsService.getDistanceFromRestaurant(
          order.latitude,
          order.longitude,
        );

      if (distanceResult) {
        order.deliveryDistance = distanceResult.distanceKm;
        order.deliveryFee = this.pricingService.calculateDeliveryFee(
          distanceResult.distanceKm,
        );
        order.driverEarnings = this.pricingService.calculateDriverEarnings(
          distanceResult.distanceKm,
        );
      }
    }

    // Cambiar estado a buscando driver
    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepository.save(order);

    // Buscar y asignar driver
    return this.findAndAssignDriver(order);
  }

  /**
   * Buscar el driver más cercano disponible y asignarle el pedido
   */
  private async findAndAssignDriver(order: Order): Promise<AssignmentResult> {
    // Obtener lista de drivers que ya rechazaron esta orden
    const rejectedIds = this.rejectedDrivers.get(order.id) || [];

    // Buscar drivers disponibles
    const availableDrivers = await this.driverRepository.find({
      where: {
        status: DriverStatus.AVAILABLE,
        isActive: true,
      },
    });

    // Filtrar drivers con ubicación y que no hayan rechazado
    const driversWithLocation = availableDrivers
      .filter(
        (d) =>
          d.lastLatitude &&
          d.lastLongitude &&
          d.appToken &&
          !rejectedIds.includes(d.id),
      )
      .map((d) => ({
        id: d.id,
        lat: d.lastLatitude!,
        lng: d.lastLongitude!,
        appToken: d.appToken!,
      }));

    if (driversWithLocation.length === 0) {
      // No hay drivers disponibles
      order.status = OrderStatus.REJECTED;
      await this.orderRepository.save(order);

      this.logger.warn(`No available drivers for order ${order.id}`);
      return {
        success: false,
        message: 'No hay conductores disponibles en este momento',
        order,
      };
    }

    // Encontrar el driver más cercano al restaurante
    const nearest = await this.googleMapsService.findNearestToRestaurant(
      driversWithLocation,
    );

    if (!nearest) {
      order.status = OrderStatus.REJECTED;
      await this.orderRepository.save(order);

      return {
        success: false,
        message: 'No se pudo calcular la distancia de los conductores',
        order,
      };
    }

    // Obtener el driver completo
    const driver = await this.driverRepository.findOne({
      where: { id: nearest.id },
    });

    if (!driver) {
      return this.findAndAssignDriver(order); // Reintentar con otro driver
    }

    // Calcular tiempo total de entrega
    let totalDeliveryTime = 0;
    if (order.latitude && order.longitude) {
      const deliveryTimeResult =
        await this.googleMapsService.calculateTotalDeliveryTime(
          driver.lastLatitude!,
          driver.lastLongitude!,
          order.latitude,
          order.longitude,
        );
      totalDeliveryTime = deliveryTimeResult.totalMinutes;
    }

    // Asignar el pedido al driver
    order.driver = driver;
    order.status = OrderStatus.ASSIGNED;
    order.assignedAt = new Date();
    order.assignmentAttempts += 1;

    // Cambiar estado del driver a ocupado
    driver.status = DriverStatus.BUSY;

    await this.orderRepository.save(order);
    await this.driverRepository.save(driver);

    // Enviar notificación push
    const notificationSent =
      await this.firebaseService.sendNewOrderNotification(
        driver.appToken!,
        order.id,
        order.orderItems?.length || 0,
        order.driverEarnings || 0,
        order.deliveryDistance || 0,
        totalDeliveryTime,
      );

    if (!notificationSent) {
      this.logger.warn(`Failed to send notification to driver ${driver.id}`);
    }

    // Configurar timeout para reasignación
    this.setupAcceptTimeout(order.id, driver.id);

    this.logger.log(
      `Order ${order.id} assigned to driver ${driver.id}. Waiting for acceptance...`,
    );

    return {
      success: true,
      message: `Pedido asignado a ${driver.name}. Esperando aceptación...`,
      order,
      driver,
      estimatedTime: totalDeliveryTime,
    };
  }

  /**
   * Configurar timeout para aceptación del pedido
   */
  private setupAcceptTimeout(orderId: string, driverId: string) {
    // Cancelar timeout anterior si existe
    this.cancelTimeout(orderId);

    const timeout = setTimeout(async () => {
      await this.handleAcceptTimeout(orderId, driverId);
    }, this.acceptTimeout);

    this.activeTimeouts.set(orderId, timeout);
  }

  /**
   * Manejar timeout de aceptación
   */
  private async handleAcceptTimeout(orderId: string, driverId: string) {
    this.logger.log(
      `Acceptance timeout for order ${orderId}, driver ${driverId}`,
    );

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver'],
    });

    if (!order || order.status !== OrderStatus.ASSIGNED) {
      return; // El pedido ya fue aceptado o cancelado
    }

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    // Notificar al driver que se agotó el tiempo
    if (driver?.appToken) {
      await this.firebaseService.sendOrderTimeoutNotification(
        driver.appToken,
        orderId,
      );
    }

    // Poner driver disponible nuevamente
    if (driver) {
      driver.status = DriverStatus.AVAILABLE;
      await this.driverRepository.save(driver);
    }

    // Agregar driver a la lista de rechazados
    const rejectedIds = this.rejectedDrivers.get(orderId) || [];
    rejectedIds.push(driverId);
    this.rejectedDrivers.set(orderId, rejectedIds);

    // Limpiar asignación
    order.driver = null;
    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepository.save(order);

    // Buscar siguiente driver
    await this.findAndAssignDriver(order);
  }

  /**
   * Driver acepta el pedido
   */
  async acceptOrder(
    orderId: string,
    driverId: string,
  ): Promise<AssignmentResult> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver', 'orderItems', 'user'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.ASSIGNED) {
      throw new BadRequestException(
        `Order is not in ASSIGNED status. Current: ${order.status}`,
      );
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('This order is not assigned to you');
    }

    // Cancelar timeout
    this.cancelTimeout(orderId);

    // Limpiar lista de rechazados
    this.rejectedDrivers.delete(orderId);

    // Actualizar estado
    order.status = OrderStatus.ACCEPTED;
    order.acceptedAt = new Date();
    await this.orderRepository.save(order);

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    this.logger.log(`Order ${orderId} accepted by driver ${driverId}`);

    return {
      success: true,
      message: 'Pedido aceptado correctamente',
      order,
      driver: driver || undefined,
    };
  }

  /**
   * Driver rechaza el pedido
   */
  async rejectOrder(
    orderId: string,
    driverId: string,
  ): Promise<AssignmentResult> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.ASSIGNED) {
      throw new BadRequestException(
        `Order is not in ASSIGNED status. Current: ${order.status}`,
      );
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('This order is not assigned to you');
    }

    // Cancelar timeout
    this.cancelTimeout(orderId);

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    // Poner driver disponible
    if (driver) {
      driver.status = DriverStatus.AVAILABLE;
      await this.driverRepository.save(driver);
    }

    // Agregar a rechazados
    const rejectedIds = this.rejectedDrivers.get(orderId) || [];
    rejectedIds.push(driverId);
    this.rejectedDrivers.set(orderId, rejectedIds);

    // Limpiar asignación y buscar otro driver
    order.driver = null;
    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepository.save(order);

    this.logger.log(
      `Order ${orderId} rejected by driver ${driverId}. Finding next driver...`,
    );

    // Buscar siguiente driver
    return this.findAndAssignDriver(order);
  }

  /**
   * Driver actualiza estado del pedido (picking_up, picked_up, in_transit, delivered)
   */
  async updateOrderProgress(
    orderId: string,
    driverId: string,
    newStatus: OrderStatus,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('This order is not assigned to you');
    }

    // Validar transiciones de estado válidas
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.ACCEPTED]: [OrderStatus.PICKING_UP],
      [OrderStatus.PICKING_UP]: [OrderStatus.PICKED_UP],
      [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
      // Estados sin transiciones permitidas desde el driver
      [OrderStatus.PENDING]: [],
      [OrderStatus.CONFIRMED]: [],
      [OrderStatus.SEARCHING_DRIVER]: [],
      [OrderStatus.ASSIGNED]: [],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REJECTED]: [],
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${newStatus}`,
      );
    }

    order.status = newStatus;

    // Actualizar timestamps según el estado
    if (newStatus === OrderStatus.PICKED_UP) {
      order.pickedUpAt = new Date();
    } else if (newStatus === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();

      // Liberar al driver
      const driver = await this.driverRepository.findOne({
        where: { id: driverId },
      });
      if (driver) {
        driver.status = DriverStatus.AVAILABLE;
        await this.driverRepository.save(driver);
      }
    }

    await this.orderRepository.save(order);

    this.logger.log(
      `Order ${orderId} status updated to ${newStatus} by driver ${driverId}`,
    );

    return order;
  }

  /**
   * Cancelar timeout activo
   */
  private cancelTimeout(orderId: string) {
    const timeout = this.activeTimeouts.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(orderId);
    }
  }
}
