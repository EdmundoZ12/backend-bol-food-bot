import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../firebase/firebase.service';
import { DeviceToken } from './entities/device-token.entity';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { OrderService } from '../order/order.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectRepository(DeviceToken)
        private readonly deviceTokenRepository: Repository<DeviceToken>,
        private readonly firebaseService: FirebaseService,
        private readonly userService: UserService,
        private readonly productService: ProductService,
        private readonly orderService: OrderService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Registrar o actualizar token de dispositivo
     */
    async registerToken(dto: RegisterTokenDto): Promise<DeviceToken> {
        try {
            // Verificar que el usuario existe
            await this.userService.findByTelegramId(dto.userId);

            // Buscar si el token ya existe
            let deviceToken = await this.deviceTokenRepository.findOne({
                where: { token: dto.token },
            });

            if (deviceToken) {
                // Actualizar token existente
                deviceToken.userId = dto.userId;
                deviceToken.deviceType = dto.deviceType || 'android';
                deviceToken.isActive = true;
                deviceToken.lastUsed = new Date();
            } else {
                // Crear nuevo token
                deviceToken = this.deviceTokenRepository.create({
                    userId: dto.userId,
                    token: dto.token,
                    deviceType: dto.deviceType || 'android',
                    isActive: true,
                    lastUsed: new Date(),
                });
            }

            await this.deviceTokenRepository.save(deviceToken);
            this.logger.log(`✅ Token registered for user ${dto.userId}`);
            return deviceToken;
        } catch (error) {
            this.logger.error('Error registering token:', error);
            throw error;
        }
    }

    /**
     * Obtener tokens activos de un usuario
     */
    async getUserTokens(userId: string): Promise<string[]> {
        const deviceTokens = await this.deviceTokenRepository.find({
            where: { userId, isActive: true },
        });

        return deviceTokens.map((dt) => dt.token);
    }

    /**
     * Enviar notificación de prueba
     */
    async sendTestNotification(
        token: string,
        title: string,
        body: string,
    ): Promise<string> {
        const logoUrl = this.configService.get<string>('BOT_LOGO_URL');

        return await this.firebaseService.sendNotification(
            token,
            title,
            body,
            logoUrl,
            {
                type: 'test',
                timestamp: new Date().toISOString(),
            },
        );
    }

    /**
     * Enviar notificación de actualización de pedido
     */
    async sendOrderUpdateNotification(
        orderId: string,
        userId: string,
        status: string,
    ): Promise<void> {
        try {
            const tokens = await this.getUserTokens(userId);

            if (tokens.length === 0) {
                this.logger.warn(`No tokens found for user ${userId}`);
                return;
            }

            const order = await this.orderService.findOne(orderId);
            const logoUrl = this.configService.get<string>('BOT_LOGO_URL');

            const statusMessages = {
                pending: '⏳ Tu pedido ha sido recibido',
                confirmed: '✅ Tu pedido ha sido confirmado',
                preparing: '👨‍🍳 Estamos preparando tu pedido',
                ready: '🎉 Tu pedido está listo',
                on_the_way: '🚗 Tu pedido está en camino',
                delivered: '✨ Tu pedido ha sido entregado',
                cancelled: '❌ Tu pedido ha sido cancelado',
            };

            const title = statusMessages[status] || 'Actualización de pedido';
            const body = `Pedido #${order.id.substring(0, 8)} - Total: Bs. ${order.totalAmount}`;

            await this.firebaseService.sendMulticastNotification(
                tokens,
                title,
                body,
                logoUrl,
                {
                    type: 'order_update',
                    orderId: order.id,
                    status,
                    totalAmount: order.totalAmount.toString(),
                },
            );

            // Actualizar lastUsed de los tokens
            await this.deviceTokenRepository.update(
                { token: tokens[0] },
                { lastUsed: new Date() },
            );

            this.logger.log(
                `✅ Order notification sent to ${tokens.length} device(s)`,
            );
        } catch (error) {
            this.logger.error('Error sending order notification:', error);
            throw error;
        }
    }

    /**
     * Obtener contador de productos disponibles
     */
    async getProductsCount(): Promise<{
        total: number;
        available: number;
        unavailable: number;
        byCategory: Record<string, number>;
    }> {
        const allProducts = await this.productService.findAll();
        const availableProducts = allProducts.filter((p) => p.available);

        const byCategory: Record<string, number> = {};
        availableProducts.forEach((product) => {
            byCategory[product.category] = (byCategory[product.category] || 0) + 1;
        });

        return {
            total: allProducts.length,
            available: availableProducts.length,
            unavailable: allProducts.length - availableProducts.length,
            byCategory,
        };
    }

    /**
     * Enviar notificación de productos disponibles
     */
    async sendProductsAvailableNotification(userId?: string): Promise<void> {
        try {
            const count = await this.getProductsCount();
            const logoUrl = this.configService.get<string>('BOT_LOGO_URL');

            const title = '🍔 Productos Disponibles';
            const body = `Tenemos ${count.available} productos disponibles en ${Object.keys(count.byCategory).length} categorías. ¡Haz tu pedido ahora!`;

            if (userId) {
                // Enviar a un usuario específico
                const tokens = await this.getUserTokens(userId);
                if (tokens.length > 0) {
                    await this.firebaseService.sendMulticastNotification(
                        tokens,
                        title,
                        body,
                        logoUrl,
                        {
                            type: 'products_available',
                            count: count.available.toString(),
                            categories: Object.keys(count.byCategory).join(','),
                        },
                    );
                }
            } else {
                // Enviar a todos los usuarios activos
                const allTokens = await this.deviceTokenRepository.find({
                    where: { isActive: true },
                });

                const tokens = allTokens.map((dt) => dt.token);

                if (tokens.length > 0) {
                    await this.firebaseService.sendMulticastNotification(
                        tokens,
                        title,
                        body,
                        logoUrl,
                        {
                            type: 'products_available',
                            count: count.available.toString(),
                            categories: Object.keys(count.byCategory).join(','),
                        },
                    );
                }
            }

            this.logger.log('✅ Products available notification sent');
        } catch (error) {
            this.logger.error('Error sending products notification:', error);
            throw error;
        }
    }

    /**
     * Desactivar token (cuando falla el envío)
     */
    async deactivateToken(token: string): Promise<void> {
        await this.deviceTokenRepository.update({ token }, { isActive: false });
        this.logger.log(`Token deactivated: ${token}`);
    }

    /**
     * Limpiar tokens inválidos
     */
    async cleanInvalidTokens(): Promise<number> {
        const tokens = await this.deviceTokenRepository.find({
            where: { isActive: true },
        });

        let invalidCount = 0;

        for (const deviceToken of tokens) {
            const isValid = await this.firebaseService.verifyToken(deviceToken.token);
            if (!isValid) {
                await this.deactivateToken(deviceToken.token);
                invalidCount++;
            }
        }

        this.logger.log(`🧹 Cleaned ${invalidCount} invalid tokens`);
        return invalidCount;
    }
}
