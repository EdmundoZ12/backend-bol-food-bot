import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { MainKeyboard } from '../keyboards/main.keyboard';

@Injectable()
export class StartHandler {
  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly configService: ConfigService,
  ) {}

  async handle(chatId: number, from: any) {
    const logoUrl = this.configService.get<string>('BOT_LOGO_URL');

    const welcomeMessage = `
🍕 ¡Bienvenido a Bol Food, ${from.first_name}!

Tu comida favorita a un click de distancia.

¿Qué te apetece hoy?
    `;

    if (logoUrl) {
      // Enviar con imagen
      await this.telegramApi.sendPhoto(
        chatId,
        logoUrl,
        welcomeMessage,
        MainKeyboard.welcome(),
      );
    } else {
      // Enviar sin imagen (fallback)
      await this.telegramApi.sendMessage(
        chatId,
        welcomeMessage,
        MainKeyboard.welcome(),
      );
    }
  }

  async handleHelp(chatId: number) {
    const helpMessage = `
ℹ️ *AYUDA*

Comandos disponibles:
/start - Iniciar el bot
/menu - Ver el menú
/cart - Ver tu carrito
/help - Mostrar esta ayuda

¿Necesitas más ayuda? Contáctanos.
    `;

    await this.telegramApi.sendMessage(chatId, helpMessage);
  }
}
