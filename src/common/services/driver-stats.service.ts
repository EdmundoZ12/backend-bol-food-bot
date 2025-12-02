import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../../order/entities/order.entity';

export interface DriverStats {
  todayDeliveries: number;
  todayEarnings: number;
  hoursWorked: number;
  acceptanceRate: number;
  totalDeliveries: number;
  totalEarnings: number;
}

@Injectable()
export class DriverStatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Obtener estadísticas del driver
   */
  async getDriverStats(driverId: string): Promise<DriverStats> {
    // Obtener inicio y fin del día actual
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
    );

    // Entregas de hoy
    const todayDeliveries = await this.orderRepository.count({
      where: {
        driver: { id: driverId },
        status: OrderStatus.DELIVERED,
        deliveredAt: Between(startOfDay, endOfDay),
      },
    });

    // Ganancias de hoy
    const todayOrders = await this.orderRepository.find({
      where: {
        driver: { id: driverId },
        status: OrderStatus.DELIVERED,
        deliveredAt: Between(startOfDay, endOfDay),
      },
      select: ['driverEarnings'],
    });

    const todayEarnings = todayOrders.reduce(
      (sum, order) => sum + (order.driverEarnings || 0),
      0,
    );

    // Total de entregas (histórico)
    const totalDeliveries = await this.orderRepository.count({
      where: {
        driver: { id: driverId },
        status: OrderStatus.DELIVERED,
      },
    });

    // Total de ganancias (histórico)
    const allDeliveredOrders = await this.orderRepository.find({
      where: {
        driver: { id: driverId },
        status: OrderStatus.DELIVERED,
      },
      select: ['driverEarnings'],
    });

    const totalEarnings = allDeliveredOrders.reduce(
      (sum, order) => sum + (order.driverEarnings || 0),
      0,
    );

    // Porcentaje de aceptación (pedidos aceptados / pedidos asignados)
    const assignedOrders = await this.orderRepository.count({
      where: {
        driver: { id: driverId },
      },
    });

    const acceptedOrders = await this.orderRepository.count({
      where: {
        driver: { id: driverId },
        status: OrderStatus.DELIVERED,
      },
    });

    const acceptanceRate =
      assignedOrders > 0
        ? Math.round((acceptedOrders / assignedOrders) * 100)
        : 100;

    // Horas trabajadas hoy (simplificado: basado en entregas)
    // En un sistema real, deberías tener una tabla de sesiones
    const hoursWorked = Math.round(todayDeliveries * 0.5 * 10) / 10; // ~30 min por entrega

    return {
      todayDeliveries,
      todayEarnings: Math.round(todayEarnings * 100) / 100,
      hoursWorked,
      acceptanceRate,
      totalDeliveries,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
    };
  }
}
