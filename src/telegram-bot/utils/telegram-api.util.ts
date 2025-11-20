import axios from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramApiUtil {
  private readonly logger = new Logger(TelegramApiUtil.name);
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')!;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Enviar mensaje de texto
   */
  async sendMessage(chatId: number, text: string, replyMarkup?: any) {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    } catch (error) {
      this.logger.error('Error sending message:', error.message);
      throw error;
    }
  }

  /**
   * Enviar foto
   */
  async sendPhoto(
    chatId: number,
    photo: string,
    caption?: string,
    replyMarkup?: any,
  ) {
    try {
      await axios.post(`${this.apiUrl}/sendPhoto`, {
        chat_id: chatId,
        photo,
        caption,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    } catch (error) {
      this.logger.error('Error sending photo:', error.message);
      throw error;
    }
  }

  /**
   * Responder a callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    try {
      await axios.post(`${this.apiUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text,
      });
    } catch (error) {
      this.logger.error('Error answering callback:', error.message);
    }
  }

  /**
   * Obtener actualizaciones (polling)
   */
  async getUpdates(offset: number, timeout: number = 30) {
    try {
      const response = await axios.get(`${this.apiUrl}/getUpdates`, {
        params: { offset, timeout },
      });
      return response.data.result || [];
    } catch (error) {
      this.logger.error('Error getting updates:', error.message);
      return [];
    }
  }

  /**
   * Enviar foto desde Buffer
   */
  async sendPhotoBuffer(
    chatId: number,
    buffer: Buffer,
    caption?: string,
    replyMarkup?: any,
  ) {
    try {
      const FormData = require('form-data');
      const form = new FormData();

      form.append('chat_id', chatId);
      form.append('photo', buffer, {
        filename: 'qr.png',
        contentType: 'image/png',
      });

      if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', 'Markdown');
      }

      if (replyMarkup) {
        form.append('reply_markup', JSON.stringify(replyMarkup));
      }

      await axios.post(`${this.apiUrl}/sendPhoto`, form, {
        headers: form.getHeaders(),
      });
    } catch (error) {
      this.logger.error('Error sending photo buffer:', error.message);
      throw error;
    }
  }

  /**
   * Editar mensaje de texto
   */
  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    replyMarkup?: any,
  ) {
    try {
      await axios.post(`${this.apiUrl}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    } catch (error) {
      this.logger.error('Error editing message:', error.message);
      throw error;
    }
  }
}
