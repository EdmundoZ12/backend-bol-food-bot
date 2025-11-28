import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { TelegramApiUtil } from './utils/telegram-api.util';
import { StartHandler } from './handlers/start.handler';
import { MenuHandler } from './handlers/menu.handler';
import { ProductHandler } from './handlers/product.handler';
import { CartHandler } from './handlers/cart.handler';
import { CheckoutHandler } from './handlers/checkout.handler';

interface TelegramUpdate {
  update_id: number;
  message?: any;
  callback_query?: any;
}

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly telegramApi: TelegramApiUtil,
    private readonly startHandler: StartHandler,
    private readonly menuHandler: MenuHandler,
    private readonly productHandler: ProductHandler,
    private readonly cartHandler: CartHandler,
    private readonly checkoutHandler: CheckoutHandler,
  ) {}

  /**
   * Se ejecuta cuando el módulo se inicializa
   */
  async onModuleInit() {
    this.logger.log('Initializing Telegram Bot in WEBHOOK mode...');
    await this.setupWebhook();
  }

  /**
   * Configura el webhook automáticamente al iniciar
   */
  private async setupWebhook() {
    const appUrl = this.configService.get<string>('APP_URL');

    if (!appUrl) {
      this.logger.warn(
        'APP_URL not configured. Webhook will not be set automatically.',
      );
      this.logger.warn(
        'Set APP_URL in your environment variables to enable automatic webhook setup.',
      );
      return;
    }

    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    this.logger.log(`Setting webhook to: ${webhookUrl}`);

    const success = await this.telegramApi.setWebhook(webhookUrl);

    if (success) {
      this.logger.log('Webhook configured successfully!');
      this.logger.log('Bot is now listening for updates via webhook...');
    } else {
      this.logger.error('Failed to configure webhook. Check your APP_URL.');
    }
  }

  /**
   * Obtener información del webhook actual
   */
  async getWebhookInfo() {
    return await this.telegramApi.getWebhookInfo();
  }

  /**
   * Maneja cada update recibido desde el webhook
   */
  async handleUpdate(update: TelegramUpdate) {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      }

      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      this.logger.error('Error handling update:', error);
    }
  }

  /**
   * Maneja mensajes de texto
   */
  async handleMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;
    const from = message.from;
    const userId = from.id.toString();

    this.logger.log(`Message from ${from.username || from.first_name}: ${text || 'location'}`);

    // Registrar o actualizar usuario
    await this.userService.upsert({
      telegramId: userId,
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
    });

    // Verificar si estamos esperando una nota
    const userState = this.checkoutHandler.getUserState(userId);
    if (userState?.awaitingNote && text) {
      await this.checkoutHandler.handleNoteReceived(chatId, userId, text);
      return;
    }

    // Verificar si estamos esperando una referencia de dirección
    if (userState?.awaitingAddress && text) {
      await this.checkoutHandler.handleAddressReferenceReceived(
        chatId,
        userId,
        text,
      );
      return;
    }

    // Manejar ubicación
    if (message.location) {
      await this.checkoutHandler.handleLocation(
        chatId,
        userId,
        message.location,
      );
      return;
    }

    // Comandos
    if (text === '/start') {
      await this.startHandler.handle(chatId, from);
    } else if (text === '/menu') {
      await this.menuHandler.handleMenu(chatId);
    } else if (text === '/cart') {
      await this.cartHandler.handleCart(chatId, userId);
    } else if (text === '/help') {
      await this.startHandler.handleHelp(chatId);
    } else {
      await this.telegramApi.sendMessage(
        chatId,
        'Comando no reconocido. Usa /start para comenzar.',
      );
    }
  }

  /**
   * Maneja callbacks (botones presionados)
   */
  async handleCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();

    this.logger.log(`Callback from ${userId}: ${data}`);

    await this.telegramApi.answerCallbackQuery(callbackQuery.id);

    // Routing de callbacks
    if (data === 'view_menu') {
      await this.menuHandler.handleMenu(chatId);
    } else if (data === 'help') {
      await this.startHandler.handleHelp(chatId);
    } else if (data.startsWith('category_')) {
      const category = data.replace('category_', '');
      await this.menuHandler.handleCategorySelection(chatId, category);
    } else if (data.startsWith('product_')) {
      const productId = data.replace('product_', '');
      await this.productHandler.handleProductSelection(
        chatId,
        productId,
        userId,
      );
    } else if (data.startsWith('add_to_cart_')) {
      const productId = data.replace('add_to_cart_', '');
      await this.productHandler.handleAddToCart(chatId, userId, productId);
    } else if (data === 'view_cart') {
      await this.cartHandler.handleCart(chatId, userId);
    } else if (data.startsWith('cart_incr_')) {
      const cartItemId = data.replace('cart_incr_', '');
      const messageId = callbackQuery.message.message_id;
      await this.cartHandler.handleIncrementItem(chatId, userId, cartItemId, messageId);
    } else if (data.startsWith('cart_decr_')) {
      const cartItemId = data.replace('cart_decr_', '');
      const messageId = callbackQuery.message.message_id;
      await this.cartHandler.handleDecrementItem(chatId, userId, cartItemId, messageId);
    } else if (data.startsWith('cart_remove_')) {
      const cartItemId = data.replace('cart_remove_', '');
      const messageId = callbackQuery.message.message_id;
      await this.cartHandler.handleRemoveItem(chatId, userId, cartItemId, messageId);
    } else if (data === 'clear_cart') {
      const messageId = callbackQuery.message.message_id;
      await this.cartHandler.handleClearCart(chatId, userId, messageId);
    } else if (data.startsWith('cart_noop_') || data.startsWith('cart_info_')) {
      // No hacer nada, es solo informativo
    } else if (data === 'checkout') {
      await this.checkoutHandler.handleCheckout(chatId, userId);
    } else if (data === 'skip_notes') {
      await this.checkoutHandler.handleSkipNotes(chatId, userId);
    } else if (data === 'add_notes') {
      await this.checkoutHandler.handleAddNotesPrompt(chatId, userId);
    } else if (data.startsWith('payment_')) {
      const method = data.replace('payment_', '');
      await this.checkoutHandler.handlePaymentSelection(chatId, userId, method);
    } else if (data === 'confirm_qr_payment') {
      await this.checkoutHandler.handleConfirmQRPayment(chatId, userId);
    } else if (data === 'share_location') {
      await this.checkoutHandler.handleShareLocationPrompt(chatId);
    } else if (data === 'skip_address_reference') {
      await this.checkoutHandler.handleSkipAddressReference(chatId, userId);
    } else if (data === 'add_address_reference') {
      await this.checkoutHandler.handleAddAddressReferencePrompt(
        chatId,
        userId,
      );
    }
  }
}
