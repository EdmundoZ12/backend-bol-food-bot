import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private firebaseApp: admin.app.App;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        try {
            const privateKey = this.configService
                .get<string>('FIREBASE_PRIVATE_KEY')
                ?.replace(/\\n/g, '\n');

            if (!privateKey) {
                console.warn('⚠️ Firebase no configurado - FIREBASE_PRIVATE_KEY no encontrada');
                return;
            }

            this.firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
                    privateKey,
                    clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
                }),
            });

            console.log('✅ Firebase Admin SDK inicializado');
        } catch (error) {
            console.error('❌ Error inicializando Firebase:', error.message);
        }
    }

    /**
     * Envía una notificación push a un driver
     */
    async sendNotificationToDriver(
        driverToken: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<void> {
        if (!this.firebaseApp) {
            console.warn('⚠️ Firebase no inicializado, no se puede enviar notificación');
            return;
        }

        try {
            await admin.messaging().send({
                token: driverToken,
                notification: {
                    title,
                    body,
                },
                data: data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'orders',
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
            });

            console.log(`✅ Notificación enviada al driver`);
        } catch (error) {
            console.error('❌ Error enviando notificación:', error.message);
            throw error;
        }
    }
}
