import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { CartService } from '../../cart/cart.service';
import { CartKeyboard } from '../keyboards/cart.keyboard';

@Injectable()
export class CartHandler {
  private readonly logger = new Logger(CartHandler.name);

  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly cartService: CartService,
  ) {}

  /**
   * Mostrar carrito
   */
  async handleCart(chatId: number, userId: string, messageId?: number) {
    const summary = await this.cartService.getCartSummary(userId);

    if (summary.totalItems === 0) {
      const message = '🛒 Tu carrito está vacío\n\n¿Qué te apetece hoy?';
      const keyboard = CartKeyboard.emptyCart();

      if (messageId) {
        await this.telegramApi.editMessageText(chatId, messageId, message, keyboard);
      } else {
        await this.telegramApi.sendMessage(chatId, message, keyboard);
      }
      return;
    }

    let message = '🛒 *TU CARRITO*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName}\n`;
      message += `   ${item.quantity} x Bs. ${item.unitPrice} = Bs. ${item.subtotal}\n`;
      if (item.notes) {
        message += `   📝 ${item.notes}\n`;
      }
      message += `\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${summary.totalAmount}*\n`;
    message += `📦 *${summary.totalItems} producto(s)*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = CartKeyboard.cart(summary.items.map(item => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
    })));

    if (messageId) {
      await this.telegramApi.editMessageText(chatId, messageId, message, keyboard);
    } else {
      await this.telegramApi.sendMessage(chatId, message, keyboard);
    }
  }

  /**
   * Incrementar cantidad de un item
   */
  async handleIncrementItem(
    chatId: number,
    userId: string,
    cartItemId: string,
    messageId: number,
  ) {
    try {
      await this.cartService.incrementItem(cartItemId);
      await this.handleCart(chatId, userId, messageId);
      this.logger.log(`Item ${cartItemId} incrementado`);
    } catch (error) {
      this.logger.error('Error incrementando item:', error.message);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al incrementar el producto. Intenta de nuevo.',
      );
    }
  }

  /**
   * Decrementar cantidad de un item
   */
  async handleDecrementItem(
    chatId: number,
    userId: string,
    cartItemId: string,
    messageId: number,
  ) {
    try {
      const result = await this.cartService.decrementItem(cartItemId);
      
      if (result === null) {
        // El item fue eliminado porque la cantidad era 1
        this.logger.log(`Item ${cartItemId} eliminado del carrito`);
      } else {
        this.logger.log(`Item ${cartItemId} decrementado`);
      }

      await this.handleCart(chatId, userId, messageId);
    } catch (error) {
      this.logger.error('Error decrementando item:', error.message);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al decrementar el producto. Intenta de nuevo.',
      );
    }
  }

  /**
   * Eliminar item del carrito
   */
  async handleRemoveItem(
    chatId: number,
    userId: string,
    cartItemId: string,
    messageId: number,
  ) {
    try {
      await this.cartService.removeItem(cartItemId);
      await this.handleCart(chatId, userId, messageId);
      this.logger.log(`Item ${cartItemId} eliminado del carrito`);
    } catch (error) {
      this.logger.error('Error eliminando item:', error.message);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al eliminar el producto. Intenta de nuevo.',
      );
    }
  }

  /**
   * Vaciar carrito completo
   */
  async handleClearCart(
    chatId: number,
    userId: string,
    messageId: number,
  ) {
    try {
      await this.cartService.clearCart(userId);
      await this.handleCart(chatId, userId, messageId);
      this.logger.log(`Carrito vaciado para usuario ${userId}`);
    } catch (error) {
      this.logger.error('Error vaciando carrito:', error.message);
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al vaciar el carrito. Intenta de nuevo.',
      );
    }
  }
}
