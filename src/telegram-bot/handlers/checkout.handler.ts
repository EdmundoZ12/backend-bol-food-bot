import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { CartService } from '../../cart/cart.service';
import { OrderService } from '../../order/order.service';
import { CartKeyboard } from '../keyboards/cart.keyboard';
import { DistanceService } from '../../common/services/distance.service';
import { PricingService } from '../../common/services/pricing.service';
import * as QRCode from 'qrcode';

interface UserState {
  orderId?: string;
  awaitingNote?: boolean;
  awaitingAddress?: boolean;
  notes?: string;
  latitude?: number;
  longitude?: number;
  deliveryFee?: number;
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
    private readonly distanceService: DistanceService,
    private readonly pricingService: PricingService,
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
   * Omitir notas e ir a ubicación
   */
  async handleSkipNotes(chatId: number, userId: string) {
    await this.handleShareLocationPrompt(chatId);
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
    this.userStates.set(userId, { ...currentState, awaitingNote: false, notes: note });

    await this.telegramApi.sendMessage(chatId, `✅ Nota guardada: "${note}"`);

    await this.handleShareLocationPrompt(chatId);
  }

  /**
   * Solicitar ubicación
   */
  async handleShareLocationPrompt(chatId: number) {
    const message = `
📍 *ENVÍA TU UBICACIÓN*

Por favor comparte tu ubicación para que el conductor pueda encontrarte y calcular el costo de envío.

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

    // Calcular distancia y costo de envío
    const distanceKm = this.distanceService.calculateDistanceFromRestaurant(latitude, longitude);
    const deliveryFee = this.pricingService.calculateDeliveryFee(distanceKm);

    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, {
      ...currentState,
      latitude,
      longitude,
      deliveryFee
    });

    await this.telegramApi.sendMessage(
      chatId,
      `✅ *Ubicación recibida*\n📏 Distancia: ${distanceKm} km\n💰 Costo de envío calculado: Bs. ${deliveryFee}\n\n¿Deseas agregar una referencia?\n(Color de casa, puntos cercanos, etc.)`,
      CartKeyboard.addressReference(),
    );
  }

  /**
   * Omitir referencia de dirección
   */
  async handleSkipAddressReference(chatId: number, userId: string) {
    await this.handlePaymentMethod(chatId, userId);
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
    const currentState = this.userStates.get(userId) || {};

    // Guardamos la referencia como nota adicional
    let notes = currentState.notes || '';
    if (notes) notes += '\n';
    notes += `Ref: ${address}`;

    this.userStates.set(userId, {
      ...currentState,
      notes,
      awaitingAddress: false,
    });

    await this.handlePaymentMethod(chatId, userId, notes);
  }

  /**
   * Mostrar opciones de método de pago
   */
  async handlePaymentMethod(chatId: number, userId: string, notes?: string) {
    const userState = this.userStates.get(userId);
    const deliveryFee = userState?.deliveryFee || 0;
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

    if (deliveryFee > 0) {
      message += `🛵 Costo de envío: Bs. ${deliveryFee}\n`;
    }

    if (notes) {
      message += `\n📝 Nota: ${notes}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${summary.totalAmount + deliveryFee}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.paymentMethod(),
    );

    // Actualizar notas en el estado si vinieron por parámetro
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
        latitude: userState?.latitude,
        longitude: userState?.longitude,
        deliveryFee: userState?.deliveryFee,
      });

      this.logger.log(`✅ Order created: ${order.id}`);

      // Guardar orderId en el estado
      this.userStates.set(userId, { ...userState, orderId: order.id });

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

      // Datos para el QR
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
    await this.handleOrderConfirmation(chatId, userId);
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

    order.orderItems.forEach((item) => {
      message += `🍽️ ${item.productName} x${item.quantity}\n`;
    });

    message += `\n💵 Total: *Bs. ${Number(order.totalAmount).toFixed(2)}*\n`;
    message += `💳 Pago: ${order.paymentMethod === 'CASH' ? 'Efectivo' : 'QR Pagado'}\n`;

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

    // Iniciar búsqueda de conductor
    await this.orderService.startAssignment(orderId);

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
