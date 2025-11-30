import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );
      const privateKey = this.configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          'Firebase credentials not found. Push notifications disabled.',
        );
        return;
      }

      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Enviar notificación push a un dispositivo
   */
  async sendPushNotification(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!admin.apps.length) {
      this.logger.warn('Firebase not initialized. Cannot send notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'orders',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send push notification: ${error.message}`);

      // Si el token es inválido, retornar false para que se pueda manejar
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid FCM token: ${token}`);
      }

      return false;
    }
  }

  /**
   * Enviar notificación de nuevo pedido al driver
   */
  async sendNewOrderNotification(
    token: string,
    orderId: string,
    itemsCount: number,
    estimatedEarnings: number,
    distanceKm: number,
    estimatedTime: number,
  ): Promise<boolean> {
    return this.sendPushNotification(token, {
      title: '🛵 ¡Nuevo Pedido!',
      body: `${itemsCount} producto(s) - Bs ${estimatedEarnings.toFixed(
        2,
      )} - ${distanceKm.toFixed(1)} km`,
      data: {
        type: 'NEW_ORDER',
        orderId,
        itemsCount: itemsCount.toString(),
        estimatedEarnings: estimatedEarnings.toString(),
        distanceKm: distanceKm.toString(),
        estimatedTime: estimatedTime.toString(),
      },
    });
  }

  /**
   * Enviar notificación de pedido cancelado
   */
  async sendOrderCancelledNotification(
    token: string,
    orderId: string,
    reason?: string,
  ): Promise<boolean> {
    return this.sendPushNotification(token, {
      title: '❌ Pedido Cancelado',
      body: reason || 'El pedido ha sido cancelado',
      data: {
        type: 'ORDER_CANCELLED',
        orderId,
      },
    });
  }

  /**
   * Enviar notificación de timeout (pedido reasignado)
   */
  async sendOrderTimeoutNotification(
    token: string,
    orderId: string,
  ): Promise<boolean> {
    return this.sendPushNotification(token, {
      title: '⏰ Tiempo Agotado',
      body: 'El pedido fue reasignado a otro conductor',
      data: {
        type: 'ORDER_TIMEOUT',
        orderId,
      },
    });
  }
}
