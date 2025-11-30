import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  private readonly logger = new Logger(TelegramBotController.name);

  constructor(private readonly telegramBotService: TelegramBotService) {}

  /**
   * Endpoint para recibir webhooks de Telegram
   * POST /api/telegram/webhook
   */
  @Post('webhook')
  async handleWebhook(@Body() update: any) {
    this.logger.log(
      `Webhook received: update_id=${update.update_id}, type=${update.message ? 'message' : update.callback_query ? 'callback' : 'unknown'}`,
    );
    await this.telegramBotService.handleUpdate(update);
    return { ok: true };
  }

  /**
   * Health check del bot
   * GET /api/telegram/health
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      mode: 'webhook',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Obtener información del webhook actual
   * GET /api/telegram/webhook-info
   */
  @Get('webhook-info')
  async getWebhookInfo() {
    return await this.telegramBotService.getWebhookInfo();
  }
}
