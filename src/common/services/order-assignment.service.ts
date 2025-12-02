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
import { DistanceService } from './distance.service';
import { PricingService } from './pricing.service';
import { FirebaseService } from './firebase.service';
import { TelegramNotificationService } from './telegram-notification.service';

@Injectable()
export class OrderAssignmentService {
  private readonly logger = new Logger(OrderAssignmentService.name);
  private readonly acceptTimeout: number;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly distanceService: DistanceService,
    private readonly pricingService: PricingService,
    private readonly firebaseService: FirebaseService,
    private readonly telegramNotificationService: TelegramNotificationService,
    private readonly configService: ConfigService,
  ) {
    this.acceptTimeout = parseInt(
      this.configService.get<string>('DRIVER_ACCEPT_TIMEOUT') || '30000',
    );
  }

  /**
   * Asignar pedido al conductor más cercano disponible
   */
  async assignOrder(orderId: string): Promise<{
    success: boolean;
    message: string;
    order: Order;
  }> {
    // Obtener orden con usuario
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'orderItems'],
    });

    if (!order) {
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    }

    // Calcular distancia y ganancias si tiene ubicación
    if (order.latitude && order.longitude) {
      const distance = this.distanceService.calculateDistanceFromRestaurant(
        order.latitude,
        order.longitude,
      );
      order.deliveryDistance = distance;
      order.deliveryFee = this.pricingService.calculateDeliveryFee(distance);
      order.driverEarnings =
        this.pricingService.calculateDriverEarnings(distance);
    }

    // Obtener lista de conductores que ya rechazaron este pedido
    const rejectedDriverIds = order.rejectedDriverIds || [];

    // Buscar conductor disponible más cercano (excluyendo los que rechazaron)
    const availableDrivers = await this.findAvailableDrivers(rejectedDriverIds);

    if (availableDrivers.length === 0) {
      order.status = OrderStatus.REJECTED;
      await this.orderRepository.save(order);

      // Notificar al cliente que no hay drivers
      await this.telegramNotificationService.notifyNoDriversAvailable(order);

      this.logger.warn(
        `No available drivers for order ${orderId}. Rejected by: ${
          rejectedDriverIds.join(', ') || 'none'
        }`,
      );
      return {
        success: false,
        message: 'No hay conductores disponibles en este momento',
        order,
      };
    }

    // Tomar el conductor más cercano (que no haya rechazado)
    const driver = availableDrivers[0];

    // Asignar conductor a la orden
    order.driver = driver;
    order.status = OrderStatus.ASSIGNED;
    order.assignedAt = new Date();
    order.assignmentAttempts += 1;

    await this.orderRepository.save(order);

    // Enviar notificación push al conductor
    if (driver.appToken) {
      await this.firebaseService.sendNewOrderNotification(
        driver.appToken,
        order.id,
        order.orderItems?.length || 0,
        order.driverEarnings || 0,
        order.deliveryDistance || 0,
        Math.round((order.deliveryDistance || 0) * 8),
      );
    }

    this.logger.log(
      `Order ${orderId} assigned to driver ${driver.id} (attempt ${order.assignmentAttempts}). Waiting for acceptance...`,
    );

    return {
      success: true,
      message: 'Pedido asignado al conductor',
      order,
    };
  }

  /**
   * Conductor acepta el pedido
   */
  async acceptOrder(
    orderId: string,
    driverId: string,
  ): Promise<{
    success: boolean;
    message: string;
    order: Order;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver', 'user', 'orderItems', 'orderItems.product', 'orderItems.product.images'],
    });

    if (!order) {
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Este pedido no está asignado a ti');
    }

    if (order.status !== OrderStatus.ASSIGNED) {
      throw new BadRequestException(
        `No puedes aceptar una orden en estado ${order.status}`,
      );
    }

    // Actualizar estado de la orden
    order.status = OrderStatus.ACCEPTED;
    order.acceptedAt = new Date();
    await this.orderRepository.save(order);

    // Cambiar estado del conductor a BUSY
    await this.driverRepository.update(driverId, { status: DriverStatus.BUSY });

    // Notificar al cliente via Telegram
    await this.telegramNotificationService.notifyOrderAccepted(order);

    this.logger.log(`Order ${orderId} accepted by driver ${driverId}`);

    return {
      success: true,
      message: 'Pedido aceptado correctamente',
      order,
    };
  }

  /**
   * Conductor rechaza el pedido
   */
  async rejectOrder(
    orderId: string,
    driverId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver', 'user'],
    });

    if (!order) {
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Este pedido no está asignado a ti');
    }

    // Agregar conductor a la lista de rechazos
    const rejectedIds = order.rejectedDriverIds || [];
    if (!rejectedIds.includes(driverId)) {
      rejectedIds.push(driverId);
    }
    order.rejectedDriverIds = rejectedIds;

    // Quitar asignación
    order.driver = null;
    order.status = OrderStatus.SEARCHING_DRIVER;
    await this.orderRepository.save(order);

    this.logger.log(
      `Order ${orderId} rejected by driver ${driverId}. Rejected drivers: ${rejectedIds.join(
        ', ',
      )}`,
    );

    // Intentar reasignar a otro conductor (excluyendo los que ya rechazaron)
    return this.assignOrder(orderId);
  }

  /**
   * Actualizar progreso del pedido
   */
  async updateOrderProgress(
    orderId: string,
    driverId: string,
    status: OrderStatus,
  ): Promise<{
    success: boolean;
    message: string;
    order: Order;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['driver', 'user', 'orderItems', 'orderItems.product', 'orderItems.product.images'],
    });

    if (!order) {
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    }

    if (order.driver?.id !== driverId) {
      throw new BadRequestException('Este pedido no está asignado a ti');
    }

    // Actualizar estado
    order.status = status;

    // Actualizar timestamps según el estado
    switch (status) {
      case OrderStatus.PICKED_UP:
        order.pickedUpAt = new Date();
        break;
      case OrderStatus.DELIVERED:
        order.deliveredAt = new Date();
        // Liberar al conductor
        await this.driverRepository.update(driverId, {
          status: DriverStatus.AVAILABLE,
        });
        break;
    }

    await this.orderRepository.save(order);

    // Notificar al cliente via Telegram
    await this.telegramNotificationService.notifyOrderStatusChange(
      order,
      status,
    );

    this.logger.log(`Order ${orderId} updated to ${status}`);

    return {
      success: true,
      message: `Estado actualizado a ${status}`,
      order,
    };
  }

  /**
   * Encontrar conductores disponibles ordenados por distancia
   * @param excludeDriverIds - IDs de conductores a excluir (los que ya rechazaron)
   */
  private async findAvailableDrivers(
    excludeDriverIds: string[] = [],
  ): Promise<Driver[]> {
    const drivers = await this.driverRepository.find({
      where: {
        status: DriverStatus.AVAILABLE,
        isActive: true,
      },
    });

    // Filtrar drivers con ubicación, excluir los que rechazaron, y ordenar por distancia
    const driversWithDistance = drivers
      .filter((d) => d.lastLatitude && d.lastLongitude)
      .filter((d) => !excludeDriverIds.includes(d.id)) // <-- EXCLUIR RECHAZADOS
      .map((driver) => ({
        driver,
        distance: this.distanceService.calculateDistanceFromRestaurant(
          driver.lastLatitude!,
          driver.lastLongitude!,
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    return driversWithDistance.map((d) => d.driver);
  }
}
