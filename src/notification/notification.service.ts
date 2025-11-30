import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService implements OnModuleInit {
    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const projectId = this.configService.get('FIREBASE_PROJECT_ID');
        const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.configService
            .get('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        clientEmail,
                        privateKey,
                    }),
                });
            }
        }
    }

    async sendPushNotification(
        token: string,
        title: string,
        body: string,
        data?: any,
    ) {
        try {
            await admin.messaging().send({
                token,
                notification: {
                    title,
                    body,
                },
                data: data || {},
            });
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }
}
