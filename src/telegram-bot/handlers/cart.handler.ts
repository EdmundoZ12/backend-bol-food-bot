import { Injectable } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { CartService } from '../../cart/cart.service';
import { CartKeyboard } from '../keyboards/cart.keyboard';

@Injectable()
export class CartHandler {
  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly cartService: CartService,
  ) {}

  /**
   * Mostrar carrito
   */
  async handleCart(chatId: number, userId: string) {
    const summary = await this.cartService.getCartSummary(userId);

    if (summary.totalItems === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        '🛒 Tu carrito está vacío\n\n¿Qué te apetece hoy?',
        CartKeyboard.emptyCart(),
      );
      return;
    }

    let message = '🛒 *TU CARRITO*\n\n';

    summary.items.forEach((item) => {
      message += `🍽️ ${item.productName}\n`;
      message += `   ${item.quantity} x Bs. ${item.unitPrice} = Bs. ${item.subtotal}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💵 *TOTAL: Bs. ${summary.totalAmount}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await this.telegramApi.sendMessage(chatId, message, CartKeyboard.cart());
  }
}
