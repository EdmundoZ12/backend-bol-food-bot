import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private firebaseApp: admin.app.App;

    constructor(private readonly configService: ConfigService) { }

    async onModuleInit() {
        await this.initializeFirebase();
    }

    /**
     * Inicializa Firebase Admin SDK
     */
    private async initializeFirebase() {
        try {
            const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
            const privateKey = this.configService
                .get<string>('FIREBASE_PRIVATE_KEY')
                ?.replace(/\\n/g, '\n'); // Convertir \n literales a saltos de línea reales
            const clientEmail = this.configService.get<string>(
                'FIREBASE_CLIENT_EMAIL',
            );

            if (!projectId || !privateKey || !clientEmail) {
                throw new Error(
                    'Firebase credentials are missing in environment variables',
                );
            }

            this.firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });

            this.logger.log('✅ Firebase Admin SDK initialized successfully');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
            throw error;
        }
    }

    /**
     * Envía una notificación push a un dispositivo específico
     */
    async sendNotification(
        token: string,
        title: string,
        body: string,
        imageUrl?: string,
        data?: Record<string, string>,
    ): Promise<string> {
        try {
            const message: admin.messaging.Message = {
                token,
                notification: {
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                },
                data: data || {},
                android: {
                    notification: {
                        imageUrl: imageUrl || undefined,
                        sound: 'default',
                        priority: 'high' as const,
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            'mutable-content': 1,
                        },
                    },
                    fcmOptions: {
                        imageUrl: imageUrl || undefined,
                    },
                },
            };

            const response = await admin.messaging().send(message);
            this.logger.log(`✅ Notification sent successfully: ${response}`);
            return response;
        } catch (error) {
            this.logger.error('❌ Error sending notification:', error);
            throw error;
        }
    }

    /**
     * Envía notificaciones a múltiples dispositivos
     */
    async sendMulticastNotification(
        tokens: string[],
        title: string,
        body: string,
        imageUrl?: string,
        data?: Record<string, string>,
    ): Promise<admin.messaging.BatchResponse> {
        try {
            const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: {
                    title,
                    body,
                    imageUrl: imageUrl || undefined,
                },
                data: data || {},
                android: {
                    notification: {
                        imageUrl: imageUrl || undefined,
                        sound: 'default',
                        priority: 'high' as const,
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            'mutable-content': 1,
                        },
                    },
                    fcmOptions: {
                        imageUrl: imageUrl || undefined,
                    },
                },
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            this.logger.log(
                `✅ Multicast notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`,
            );
            return response;
        } catch (error) {
            this.logger.error('❌ Error sending multicast notification:', error);
            throw error;
        }
    }

    /**
     * Verifica si un token es válido
     */
    async verifyToken(token: string): Promise<boolean> {
        try {
            await admin.messaging().send(
                {
                    token,
                    data: { test: 'true' },
                },
                true, // dryRun = true (no envía realmente)
            );
            return true;
        } catch (error) {
            this.logger.warn(`Token inválido: ${token}`);
            return false;
        }
    }

    /**
     * Obtiene la instancia de Firebase App
     */
    getApp(): admin.app.App {
        return this.firebaseApp;
    }
}
