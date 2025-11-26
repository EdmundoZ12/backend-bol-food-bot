import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { TestNotificationDto } from './dto/test-notification.dto';
import { OrderNotificationDto } from './dto/order-notification.dto';

@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    /**
     * POST /notifications/register-token
     * Registra un token FCM de dispositivo
     */
    @Post('register-token')
    async registerToken(@Body() dto: RegisterTokenDto) {
        const deviceToken = await this.notificationService.registerToken(dto);
        return {
            success: true,
            message: 'Token registered successfully',
            data: deviceToken,
        };
    }

    /**
     * POST /notifications/test
     * Envía una notificación de prueba
     */
    @Post('test')
    async sendTestNotification(@Body() dto: TestNotificationDto) {
        const response = await this.notificationService.sendTestNotification(
            dto.token,
            dto.title,
            dto.body,
        );

        return {
            success: true,
            message: 'Test notification sent successfully',
            data: { messageId: response },
        };
    }

    /**
     * POST /notifications/order-update
     * Envía notificación de actualización de pedido
     */
    @Post('order-update')
    async sendOrderNotification(@Body() dto: OrderNotificationDto) {
        await this.notificationService.sendOrderUpdateNotification(
            dto.orderId,
            dto.userId,
            dto.status,
        );

        return {
            success: true,
            message: 'Order notification sent successfully',
        };
    }

    /**
     * GET /notifications/products-count
     * Obtiene el contador de productos disponibles
     */
    @Get('products-count')
    async getProductsCount() {
        const count = await this.notificationService.getProductsCount();

        return {
            success: true,
            data: count,
        };
    }

    /**
     * POST /notifications/products-available
     * Envía notificación de productos disponibles
     */
    @Post('products-available')
    async sendProductsAvailableNotification(
        @Query('userId') userId?: string,
    ) {
        await this.notificationService.sendProductsAvailableNotification(userId);

        return {
            success: true,
            message: userId
                ? `Notification sent to user ${userId}`
                : 'Notification sent to all users',
        };
    }

    /**
     * GET /notifications/user/:userId/tokens
     * Obtiene todos los tokens de un usuario
     */
    @Get('user/:userId/tokens')
    async getUserTokens(@Param('userId') userId: string) {
        const tokens = await this.notificationService.getUserTokens(userId);

        return {
            success: true,
            data: tokens,
        };
    }

    /**
     * POST /notifications/token/:token/deactivate
     * Desactiva un token específico
     */
    @Post('token/:token/deactivate')
    async deactivateToken(@Param('token') token: string) {
        await this.notificationService.deactivateToken(token);

        return {
            success: true,
            message: 'Token deactivated successfully',
        };
    }
}
