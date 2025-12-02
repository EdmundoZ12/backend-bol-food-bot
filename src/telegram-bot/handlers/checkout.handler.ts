import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { CartService } from '../../cart/cart.service';
import { OrderService } from '../../order/order.service';
import { CartKeyboard } from '../keyboards/cart.keyboard';
import * as QRCode from 'qrcode';

interface UserState {
  orderId?: string;
  awaitingNote?: boolean;
  awaitingAddress?: boolean;
  notes?: string;
}

@Injectable()
export class CheckoutHandler {
  private readonly logger = new Logger(CheckoutHandler.name);
  private userStates: Map<string, UserState> = new Map();

  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly cartService: CartService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) { }

  /**
   * Iniciar checkout
   */
  async handleCheckout(chatId: number, userId: string) {
    const summary = await this.cartService.getCartSummary(userId);

    if (summary.totalItems === 0) {
      await this.telegramApi.sendMessage(chatId, '❌ Tu carrito está vacío');
      return;
    }

    let message = '📦 *RESUMEN DE TU PEDIDO*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName} x${item.quantity}\n`;
      message += `   Bs. ${item.subtotal}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${summary.totalAmount}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `¿Alguna indicación especial para tu pedido?\n`;
    message += `(Sin cebolla, extra salsa, etc.)`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.checkout(),
    );
  }

  /**
   * Omitir notas e ir a método de pago
   */
  async handleSkipNotes(chatId: number, userId: string) {
    await this.handlePaymentMethod(chatId, userId);
  }

  /**
   * Solicitar nota al usuario
   */
  async handleAddNotesPrompt(chatId: number, userId: string) {
    this.userStates.set(userId, { awaitingNote: true });

    await this.telegramApi.sendMessage(
      chatId,
      '✍️ *Escribe tu nota:*\n\nEjemplos:\n• Sin cebolla en la hamburguesa\n• Extra salsa picante\n• Bien dorado el pollo',
    );
  }

  /**
   * Procesar nota recibida
   */
  async handleNoteReceived(chatId: number, userId: string, note: string) {
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, { ...currentState, awaitingNote: false });

    await this.telegramApi.sendMessage(chatId, `✅ Nota guardada: "${note}"`);

    await this.handlePaymentMethod(chatId, userId, note);
  }

  /**
   * Mostrar opciones de método de pago
   */
  async handlePaymentMethod(chatId: number, userId: string, notes?: string) {
    const summary = await this.cartService.getCartSummary(userId);

    if (summary.totalItems === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Tu carrito está vacío. Por favor agrega productos primero.',
      );
      return;
    }

    let message = '💳 *¿CÓMO DESEAS PAGAR?*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName} x${item.quantity} - Bs. ${item.subtotal}\n`;
    });

    if (notes) {
      message += `\n📝 Nota: ${notes}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${summary.totalAmount}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.paymentMethod(),
    );

    if (notes) {
      const currentState = this.userStates.get(userId) || {};
      this.userStates.set(userId, { ...currentState, notes });
    }
  }

  /**
   * Procesar selección de método de pago
   * ← AQUÍ SE CREA LA ORDEN (única vez)
   */
  async handlePaymentSelection(chatId: number, userId: string, method: string) {
    try {
      this.logger.log(
        `💳 Payment selection - UserId: ${userId}, Method: ${method}`,
      );

      const userState = this.userStates.get(userId);
      const notes = userState?.notes;

      // DEBUG: Verificar carrito antes de crear orden
      const cartSummary = await this.cartService.getCartSummary(userId);
      this.logger.log(
        `🛒 Cart items: ${cartSummary.totalItems}, Total: ${cartSummary.totalAmount}`,
      );

      if (cartSummary.totalItems === 0) {
        await this.telegramApi.sendMessage(
          chatId,
          '❌ Tu carrito está vacío. Por favor agrega productos primero.',
        );
        return;
      }

      // Crear orden desde el carrito (ÚNICA VEZ)
      const order = await this.orderService.createFromCart({
        userId,
        paymentMethod: method as 'CASH' | 'QR',
        notes: notes || undefined,
      });

      this.logger.log(`✅ Order created: ${order.id}`);

      // Guardar orderId en el estado
      this.userStates.set(userId, { orderId: order.id });

      if (method === 'QR') {
        await this.handleQRPayment(chatId, userId, order.id);
      } else {
        await this.handleCashPayment(chatId, userId, order.id);
      }
    } catch (error) {
      this.logger.error('Error creating order:', error);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al crear el pedido. Por favor intenta de nuevo desde el carrito.',
      );
    }
  }

  /**
   * Manejar pago con QR
   */

  async handleQRPayment(chatId: number, userId: string, orderId: string) {
    try {
      const order = await this.orderService.getOrderSummary(orderId);

      // Datos para el QR (puedes personalizarlo)
      const qrData = JSON.stringify({
        pedido: orderId.substring(0, 8),
        monto: order.totalAmount,
        comercio: 'Bol Food',
        fecha: new Date().toISOString(),
      });

      // Generar QR como Data URL (base64)
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const message = `
📱 *PAGO CON QR*

Escanea el código y realiza el pago:

💵 Monto: *Bs. ${order.totalAmount}*
📦 Pedido: #${orderId.substring(0, 8)}

Una vez realizado el pago, presiona el botón:
    `;

      // Convertir Data URL a Buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Enviar como Buffer
      await this.telegramApi.sendPhotoBuffer(
        chatId,
        buffer,
        message,
        CartKeyboard.confirmQRPayment(),
      );

      this.logger.log(`✅ QR code sent for order ${orderId}`);
    } catch (error) {
      this.logger.error('Error sending QR payment:', error);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al generar el código QR. Por favor intenta nuevamente.',
      );
    }
  }

  /**
   * Manejar pago en efectivo
   */
  async handleCashPayment(chatId: number, userId: string, orderId: string) {
    await this.orderService.confirmPayment(orderId);

    const message = `
💵 *PAGO EN EFECTIVO*

Pagarás en efectivo al recibir tu pedido.

Ahora necesitamos tu ubicación para la entrega.
  `;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.shareLocation(),
    );
  }

  /**
   * Confirmar pago QR
   */
  async handleConfirmQRPayment(chatId: number, userId: string) {
    const userState = this.userStates.get(userId);
    const orderId = userState?.orderId;

    if (!orderId) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error: No se encontró el pedido',
      );
      return;
    }

    await this.orderService.confirmPayment(orderId);

    await this.telegramApi.sendMessage(
      chatId,
      '✅ Pago confirmado\n\nAhora necesitamos tu ubicación para la entrega.',
      CartKeyboard.shareLocation(),
    );
  }

  /**
   * Solicitar ubicación
   */
  async handleShareLocationPrompt(chatId: number) {
    const message = `
📍 *ENVÍA TU UBICACIÓN*

Por favor comparte tu ubicación para que el conductor pueda encontrarte.

Usa el botón de abajo o el clip 📎 → Ubicación
  `;

    const keyboard = {
      keyboard: [[{ text: '📍 Compartir Ubicación', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };

    await this.telegramApi.sendMessage(chatId, message, keyboard);
  }

  /**
   * Procesar ubicación recibida
   */
  async handleLocation(chatId: number, userId: string, location: any) {
    const { latitude, longitude } = location;

    const userState = this.userStates.get(userId);
    const orderId = userState?.orderId;

    if (!orderId) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error: No se encontró el pedido',
      );
      return;
    }

    await this.orderService.setLocation(orderId, latitude, longitude);

    await this.telegramApi.sendMessage(
      chatId,
      `✅ *Ubicación recibida*\n\n¿Deseas agregar una referencia?\n(Color de casa, puntos cercanos, etc.)`,
      CartKeyboard.addressReference(),
    );
  }

  /**
   * Omitir referencia de dirección
   */
  async handleSkipAddressReference(chatId: number, userId: string) {
    await this.handleOrderConfirmation(chatId, userId);
  }

  /**
   * Solicitar referencia de dirección
   */
  async handleAddAddressReferencePrompt(chatId: number, userId: string) {
    this.userStates.set(userId, {
      ...this.userStates.get(userId),
      awaitingAddress: true,
    });

    await this.telegramApi.sendMessage(
      chatId,
      '✏️ *Escribe tu referencia:*\n\nEjemplo: "Casa verde con portón negro, al lado del mercado La Ramada"',
    );
  }

  /**
   * Procesar referencia de dirección recibida
   */
  async handleAddressReferenceReceived(
    chatId: number,
    userId: string,
    address: string,
  ) {
    const userState = this.userStates.get(userId);
    const orderId = userState?.orderId;

    if (!orderId) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error: No se encontró el pedido',
      );
      return;
    }

    const order = await this.orderService.findOne(orderId);
    await this.orderService.setLocation(
      orderId,
      order.latitude!,
      order.longitude!,
      address,
    );

    this.userStates.set(userId, {
      ...userState,
      awaitingAddress: false,
    });

    await this.handleOrderConfirmation(chatId, userId);
  }

  /**
   * Confirmación final del pedido
   */
  async handleOrderConfirmation(chatId: number, userId: string) {
    const userState = this.userStates.get(userId);
    const orderId = userState?.orderId;

    if (!orderId) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error: No se encontró el pedido',
      );
      return;
    }

    const order = await this.orderService.getOrderSummary(orderId);

    let message = `✅ *¡PEDIDO CONFIRMADO!*\n\n`;
    message += `📦 Número de pedido: #${orderId.substring(0, 8)}\n\n`;
    message += `*Resumen:*\n`;

    order.items.forEach((item) => {
      message += `🍽️ ${item.productName} x${item.quantity}\n`;
    });

    message += `\n💵 Total: *Bs. ${order.totalAmount}*\n`;
    message += `💳 Pago: ${order.paymentMethod === 'CASH' ? 'Efectivo' : 'QR Pagado'
      }\n`;

    if (order.notes) {
      message += `📝 Nota: ${order.notes}\n`;
    }

    if (order.deliveryAddress) {
      message += `📍 Dirección: ${order.deliveryAddress}\n`;
    }

    message += `\n⏱️ Tiempo estimado: 30-45 min\n\n`;
    message += `Te notificaremos cuando tu pedido esté en camino.`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.orderConfirmed(),
    );

    // Limpiar estado del usuario
    this.userStates.delete(userId);
  }

  /**
   * Verificar si el usuario está esperando input
   */
  getUserState(userId: string): UserState | undefined {
    return this.userStates.get(userId);
  }
}
