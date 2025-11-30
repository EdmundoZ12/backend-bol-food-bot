import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { OrderAssignmentHistory } from './entities/order-assignment-history.entity';
import { DistanceCalculator } from './utils/distance-calculator';
import { Order } from '../order/entities/order.entity';
import axios from 'axios';

@Injectable()
export class DriverAssignmentService {
    private readonly logger = new Logger(DriverAssignmentService.name);

    constructor(
        @InjectRepository(Driver)
        private readonly driverRepository: Repository<Driver>,
        @InjectRepository(DriverLocation)
        private readonly driverLocationRepository: Repository<DriverLocation>,
        @InjectRepository(OrderAssignmentHistory)
        private readonly assignmentHistoryRepository: Repository<OrderAssignmentHistory>,
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Asigna un pedido al repartidor más cercano disponible
     */
    async assignOrderToNearestDriver(orderId: string): Promise<Driver> {
        try {
            // 1. Obtener ubicación del restaurante
            const restaurantLocation = {
                latitude: parseFloat(
                    this.configService.get('RESTAURANT_LATITUDE') || '-16.5000',
                ),
                longitude: parseFloat(
                    this.configService.get('RESTAURANT_LONGITUDE') || '-68.1500',
                ),
            };

            // 2. Obtener repartidores disponibles (excluyendo los que ya rechazaron)
            const availableDrivers = await this.getAvailableDrivers(orderId);

            if (availableDrivers.length === 0) {
                throw new NotFoundException(
                    'No hay repartidores disponibles en este momento',
                );
            }

            // 3. Obtener API Key de Google Maps
            const googleMapsApiKey = this.configService.get('GOOGLE_MAPS_API_KEY');

            // 4. Calcular distancias REALES usando Google Maps (asíncrono)
            const driversWithDistancePromises = availableDrivers.map(
                async (driver) => {
                    const distanceData = await DistanceCalculator.calculateRealDistance(
                        restaurantLocation.latitude,
                        restaurantLocation.longitude,
                        driver.currentLatitude,
                        driver.currentLongitude,
                        googleMapsApiKey,
                    );

                    return {
                        driver,
                        distanceMeters: distanceData.distanceMeters,
                        distanceKm: distanceData.distanceKm,
                        durationMinutes: distanceData.durationMinutes,
                    };
                },
            );

            // Esperar a que se calculen todas las distancias
            const driversWithDistance = await Promise.all(
                driversWithDistancePromises,
            );

            // Ordenar por distancia (más cercano primero)
            driversWithDistance.sort(
                (a, b) => a.distanceMeters - b.distanceMeters,
            );

            // 5. Asignar al más cercano
            const nearest = driversWithDistance[0];

            this.logger.log(
                `Asignando pedido ${orderId} a repartidor ${nearest.driver.name} ` +
                `(${nearest.distanceMeters}m / ${nearest.distanceKm}km - ${nearest.durationMinutes} min)`,
            );

            // 6. Crear registro de asignación
            await this.createAssignmentHistory(
                orderId,
                nearest.driver.id,
                nearest.distanceMeters,
            );

            // 7. Actualizar estado del pedido
            await this.orderRepository.update(orderId, {
                driver: nearest.driver,
            });

            // 8. Enviar notificación al repartidor
            await this.notifyDriver(
                nearest.driver,
                orderId,
                nearest.distanceMeters,
                nearest.durationMinutes,
            );

            return nearest.driver;
        } catch (error) {
            this.logger.error(`Error asignando pedido: ${error.message}`);
            throw error;
        }
    }

    /**
     * Maneja el rechazo de un pedido por parte de un repartidor
     */
    async handleDriverRejection(
        orderId: string,
        driverId: string,
    ): Promise<void> {
        try {
            // 1. Marcar como rechazado
            await this.markAsRejected(orderId, driverId);

            this.logger.log(
                `Repartidor ${driverId} rechazó pedido ${orderId}. Reasignando...`,
            );

            // 2. Reasignar al siguiente repartidor
            await this.assignOrderToNearestDriver(orderId);
        } catch (error) {
            this.logger.error(`Error manejando rechazo: ${error.message}`);
            throw error;
        }
    }

    /**
     * Maneja la aceptación de un pedido por parte de un repartidor
     */
    async handleDriverAcceptance(
        orderId: string,
        driverId: string,
    ): Promise<void> {
        try {
            // Actualizar estado de la asignación
            await this.assignmentHistoryRepository.update(
                { orderId, driverId, status: 'pending' },
                { status: 'accepted' },
            );

            // Actualizar estado del repartidor
            await this.driverRepository.update(driverId, { status: 'BUSY' });

            // Actualizar estado del pedido
            await this.orderRepository.update(orderId, { status: 'CONFIRMED' });

            this.logger.log(`Repartidor ${driverId} aceptó pedido ${orderId}`);
        } catch (error) {
            this.logger.error(`Error manejando aceptación: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene repartidores disponibles excluyendo los que ya rechazaron
     */
    private async getAvailableDrivers(orderId: string): Promise<Driver[]> {
        // Obtener IDs de repartidores que ya rechazaron este pedido
        const rejectedDriverIds = await this.assignmentHistoryRepository
            .find({
                where: { orderId, status: 'rejected' },
                select: ['driverId'],
            })
            .then((records) => records.map((r) => r.driverId));

        // Construir condiciones de búsqueda
        const whereConditions: any = {
            status: 'AVAILABLE',
            currentLatitude: Not(IsNull()),
            currentLongitude: Not(IsNull()),
        };

        // Excluir repartidores rechazados si existen
        if (rejectedDriverIds.length > 0) {
            whereConditions.id = Not(In(rejectedDriverIds));
        }

        return await this.driverRepository.find({
            where: whereConditions,
        });
    }

    /**
     * Crea un registro en el historial de asignaciones
     */
    private async createAssignmentHistory(
        orderId: string,
        driverId: string,
        distanceMeters: number,
    ): Promise<void> {
        const assignment = this.assignmentHistoryRepository.create({
            orderId,
            driverId,
            distanceMeters,
            status: 'pending',
        });

        await this.assignmentHistoryRepository.save(assignment);
    }

    /**
     * Marca una asignación como rechazada
     */
    private async markAsRejected(
        orderId: string,
        driverId: string,
    ): Promise<void> {
        await this.assignmentHistoryRepository.update(
            { orderId, driverId, status: 'pending' },
            {
                status: 'rejected',
                rejectedAt: new Date(),
            },
        );
    }

    /**
     * Envía notificación al repartidor por Telegram
     */
    private async notifyDriver(
        driver: Driver,
        orderId: string,
        distanceMeters: number,
        durationMinutes?: number,
    ): Promise<void> {
        if (!driver.telegramId) {
            this.logger.warn(
                `Repartidor ${driver.id} no tiene Telegram ID configurado`,
            );
            return;
        }

        try {
            const order = await this.orderRepository.findOne({
                where: { id: orderId },
            });

            if (!order) {
                this.logger.warn(`Pedido ${orderId} no encontrado`);
                return;
            }

            const distanceKm = (distanceMeters / 1000).toFixed(2);
            const durationText = durationMinutes
                ? `⏱️ Tiempo estimado: ${durationMinutes} min\n`
                : '';

            const message =
                `🚗 *Nuevo pedido asignado*\n\n` +
                `📦 Pedido: #${orderId.substring(0, 8)}\n` +
                `💰 Total: Bs. ${order.totalAmount}\n` +
                `📍 Dirección: ${order.deliveryAddress || 'No especificada'}\n` +
                `📏 Distancia: ${distanceKm} km (${distanceMeters}m)\n` +
                durationText +
                `\n¿Aceptas este pedido?`;

            const telegramToken = this.configService.get('TELEGRAM_BOT_TOKEN');
            const apiUrl = `https://api.telegram.org/bot${telegramToken}`;

            await axios.post(`${apiUrl}/sendMessage`, {
                chat_id: driver.telegramId,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '✅ Aceptar',
                                callback_data: `accept_order_${orderId}`,
                            },
                            {
                                text: '❌ Rechazar',
                                callback_data: `reject_order_${orderId}`,
                            },
                        ],
                    ],
                },
            });

            this.logger.log(
                `Notificación enviada a repartidor ${driver.name} por Telegram`,
            );
        } catch (error) {
            this.logger.error(
                `Error enviando notificación por Telegram: ${error.message}`,
            );
        }
    }

    /**
     * Obtiene el historial de asignaciones de un pedido
     */
    async getOrderAssignmentHistory(
        orderId: string,
    ): Promise<OrderAssignmentHistory[]> {
        return await this.assignmentHistoryRepository.find({
            where: { orderId },
            relations: ['driver'],
            order: { assignedAt: 'DESC' },
        });
    }
}
