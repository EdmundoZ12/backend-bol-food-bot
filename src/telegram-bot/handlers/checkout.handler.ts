import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { CartService } from '../../cart/cart.service';
import { OrderService } from '../../order/order.service';
import { OrderAssignmentService } from '../../common/services/order-assignment.service';
import { CartKeyboard } from '../keyboards/cart.keyboard';
import { OrderStatus } from '../../order/entities/order.entity';
import * as QRCode from 'qrcode';

interface UserState {
  orderId?: string;
  awaitingNote?: boolean;
  awaitingAddress?: boolean;
  notes?: string;
  latitude?: number;
  longitude?: number;
  deliveryFee?: number;
  deliveryDistance?: number;
  estimatedTime?: number;
  deliveryAddress?: string;
}

@Injectable()
export class CheckoutHandler {
  private readonly logger = new Logger(CheckoutHandler.name);
  private userStates: Map<string, UserState> = new Map();

  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly orderAssignmentService: OrderAssignmentService,
  ) {}

  /**
   * PASO 1: Iniciar checkout - Mostrar resumen y PEDIR UBICACIÓN PRIMERO
   */
  async handleCheckout(chatId: number, userId: string) {
    const summary = await this.cartService.getCartSummary(userId);

    if (summary.totalItems === 0) {
      await this.telegramApi.sendMessage(chatId, '❌ Tu carrito está vacío');
      return;
    }

    // Limpiar estado previo
    this.userStates.set(userId, {});

    let message = '📦 *RESUMEN DE TU PEDIDO*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName} x${item.quantity}\n`;
      message += `   Bs. ${item.subtotal.toFixed(2)}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 *Subtotal: Bs. ${summary.totalAmount.toFixed(2)}*\n`;
    message += `🛵 *Delivery: Por calcular*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📍 *Primero envía tu ubicación* para calcular el costo de envío.`;

    const keyboard = {
      keyboard: [[{ text: '📍 Enviar mi Ubicación', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };

    await this.telegramApi.sendMessage(chatId, message, keyboard);
  }

  /**
   * PASO 2: Procesar ubicación - CALCULAR DELIVERY Y MOSTRAR TOTAL REAL
   */
  async handleLocation(chatId: number, userId: string, location: any) {
    const { latitude, longitude } = location;

    // Calcular delivery fee usando el servicio
    const deliveryInfo = this.orderService.calculateDeliveryFeeByLocation(
      latitude,
      longitude,
    );

    // Guardar en estado del usuario
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, {
      ...currentState,
      latitude,
      longitude,
      deliveryFee: deliveryInfo.deliveryFee,
      deliveryDistance: deliveryInfo.distance,
      estimatedTime: deliveryInfo.estimatedTime,
    });

    // Obtener resumen del carrito
    const summary = await this.cartService.getCartSummary(userId);
    const totalConDelivery = summary.totalAmount + deliveryInfo.deliveryFee;

    let message = `✅ *Ubicación recibida*\n\n`;
    message += `📍 Distancia: ${deliveryInfo.distance.toFixed(2)} km\n`;
    message += `⏱️ Tiempo estimado: ${deliveryInfo.estimatedTime} min\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 Subtotal: Bs. ${summary.totalAmount.toFixed(2)}\n`;
    message += `🛵 Delivery: Bs. ${deliveryInfo.deliveryFee.toFixed(2)}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${totalConDelivery.toFixed(2)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `¿Deseas agregar una referencia de dirección?\n`;
    message += `(Ej: Casa verde, al lado del mercado)`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.addressReference(),
    );
  }

  /**
   * PASO 3A: Omitir referencia de dirección → Ir a notas
   */
  async handleSkipAddressReference(chatId: number, userId: string) {
    await this.askForNotes(chatId, userId);
  }

  /**
   * PASO 3B: Solicitar referencia de dirección
   */
  async handleAddAddressReferencePrompt(chatId: number, userId: string) {
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, {
      ...currentState,
      awaitingAddress: true,
    });

    await this.telegramApi.sendMessage(
      chatId,
      '✏️ *Escribe tu referencia:*\n\nEjemplo: "Casa verde con portón negro, al lado del mercado La Ramada"',
    );
  }

  /**
   * PASO 3C: Procesar referencia de dirección recibida → Ir a notas
   */
  async handleAddressReferenceReceived(
    chatId: number,
    userId: string,
    address: string,
  ) {
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, {
      ...currentState,
      awaitingAddress: false,
      deliveryAddress: address,
    });

    await this.telegramApi.sendMessage(
      chatId,
      `✅ Referencia guardada: "${address}"`,
    );
    await this.askForNotes(chatId, userId);
  }

  /**
   * PASO 4: Preguntar por notas especiales
   */
  async askForNotes(chatId: number, userId: string) {
    await this.telegramApi.sendMessage(
      chatId,
      '✍️ *¿Alguna indicación especial?*\n\n(Sin cebolla, extra salsa, etc.)',
      CartKeyboard.checkout(),
    );
  }

  /**
   * PASO 5A: Omitir notas → Ir a método de pago
   */
  async handleSkipNotes(chatId: number, userId: string) {
    await this.handlePaymentMethod(chatId, userId);
  }

  /**
   * PASO 5B: Solicitar nota al usuario
   */
  async handleAddNotesPrompt(chatId: number, userId: string) {
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, { ...currentState, awaitingNote: true });

    await this.telegramApi.sendMessage(
      chatId,
      '✍️ *Escribe tu nota:*\n\nEjemplos:\n• Sin cebolla en la hamburguesa\n• Extra salsa picante\n• Bien dorado el pollo',
    );
  }

  /**
   * PASO 5C: Procesar nota recibida → Ir a método de pago
   */
  async handleNoteReceived(chatId: number, userId: string, note: string) {
    const currentState = this.userStates.get(userId) || {};
    this.userStates.set(userId, {
      ...currentState,
      awaitingNote: false,
      notes: note,
    });

    await this.telegramApi.sendMessage(chatId, `✅ Nota guardada: "${note}"`);
    await this.handlePaymentMethod(chatId, userId, note);
  }

  /**
   * PASO 6: Mostrar opciones de método de pago CON DELIVERY INCLUIDO
   */
  async handlePaymentMethod(chatId: number, userId: string, notes?: string) {
    const summary = await this.cartService.getCartSummary(userId);
    const userState = this.userStates.get(userId);

    if (summary.totalItems === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Tu carrito está vacío. Por favor agrega productos primero.',
      );
      return;
    }

    // Verificar que tengamos la ubicación
    if (!userState?.deliveryFee) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error: No se ha calculado el delivery. Por favor inicia el checkout de nuevo con /cart',
      );
      return;
    }

    const deliveryFee = userState.deliveryFee;
    const totalConDelivery = summary.totalAmount + deliveryFee;

    // Guardar notas si se proporcionaron
    if (notes) {
      this.userStates.set(userId, { ...userState, notes });
    }

    let message = '💳 *¿CÓMO DESEAS PAGAR?*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName} x${
        item.quantity
      } - Bs. ${item.subtotal.toFixed(2)}\n`;
    });

    const savedNotes = notes || userState.notes;
    if (savedNotes) {
      message += `\n📝 Nota: ${savedNotes}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 Subtotal: Bs. ${summary.totalAmount.toFixed(2)}\n`;
    message += `🛵 Delivery: Bs. ${deliveryFee.toFixed(2)}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${totalConDelivery.toFixed(2)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.paymentMethod(),
    );
  }

  /**
   * PASO 7: Procesar selección de método de pago - CREAR ORDEN
   */
  async handlePaymentSelection(chatId: number, userId: string, method: string) {
    try {
      this.logger.log(
        `💳 Payment selection - UserId: ${userId}, Method: ${method}`,
      );

      const userState = this.userStates.get(userId);

      // Verificar que tengamos ubicación
      if (!userState?.latitude || !userState?.longitude) {
        await this.telegramApi.sendMessage(
          chatId,
          '❌ Error: No se encontró tu ubicación. Por favor inicia el checkout de nuevo con /cart',
        );
        return;
      }

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

      // Crear orden desde el carrito
      const order = await this.orderService.createFromCart({
        userId,
        paymentMethod: method as 'CASH' | 'QR',
        notes: userState.notes || undefined,
      });

      this.logger.log(`✅ Order created: ${order.id}`);

      // Guardar ubicación y calcular delivery en la orden
      await this.orderService.setLocation(
        order.id,
        userState.latitude,
        userState.longitude,
        userState.deliveryAddress || undefined,
      );

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
   * PASO 8A: Manejar pago con QR
   */
  async handleQRPayment(chatId: number, userId: string, orderId: string) {
    try {
      const order = await this.orderService.getOrderSummary(orderId);

      // Datos para el QR
      const qrData = JSON.stringify({
        pedido: orderId.substring(0, 8),
        monto: order.totalWithDelivery,
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

━━━━━━━━━━━━━━━━━━━━
🛒 Subtotal: Bs. ${order.totalAmount.toFixed(2)}
🛵 Delivery: Bs. ${(order.deliveryFee || 0).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL: Bs. ${order.totalWithDelivery.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━

📦 Pedido: #${orderId.substring(0, 8)}

Una vez realizado el pago, presiona el botón:
      `;

      // Convertir Data URL a Buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

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
   * PASO 8B: Manejar pago en efectivo → Confirmar directamente
   */
  async handleCashPayment(chatId: number, userId: string, orderId: string) {
    await this.orderService.confirmPayment(orderId);
    await this.handleOrderConfirmation(chatId, userId);
  }

  /**
   * PASO 9: Confirmar pago QR → Confirmar pedido
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
   * Solicitar ubicación (legacy - redirige al checkout)
   */
  async handleShareLocationPrompt(chatId: number) {
    const message = `
📍 *ENVÍA TU UBICACIÓN*

Por favor comparte tu ubicación para calcular el costo de envío.

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
   * PASO 10: Confirmación final del pedido Y BUSCAR CONDUCTOR
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

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 Subtotal: Bs. ${order.totalAmount.toFixed(2)}\n`;
    message += `🛵 Delivery: Bs. ${(order.deliveryFee || 0).toFixed(2)}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *Total: Bs. ${order.totalWithDelivery.toFixed(2)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💳 Pago: ${
      order.paymentMethod === 'CASH' ? 'Efectivo' : 'QR'
    }\n`;

    if (order.notes) {
      message += `📝 Nota: ${order.notes}\n`;
    }

    if (order.deliveryAddress) {
      message += `📍 Dirección: ${order.deliveryAddress}\n`;
    }

    message += `\n🔍 *Buscando conductor...*\n`;
    message += `Te notificaremos cuando un conductor acepte tu pedido.`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      CartKeyboard.orderConfirmed(),
    );

    // IMPORTANTE: Cambiar estado y buscar conductor
    await this.orderService.updateStatus(orderId, OrderStatus.SEARCHING_DRIVER);

    // Disparar búsqueda de conductor
    try {
      await this.orderAssignmentService.assignOrder(orderId);
      this.logger.log(`🚗 Driver search initiated for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Error assigning order ${orderId}:`, error);
    }

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
