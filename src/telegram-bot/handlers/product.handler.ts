import { Injectable } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { ProductService } from '../../product/product.service';
import { CartService } from '../../cart/cart.service';
import { ProductKeyboard } from '../keyboards/product.keyboard';

@Injectable()
export class ProductHandler {
  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
  ) {}

  /**
   * Mostrar detalles de un producto
   */
  async handleProductSelection(
    chatId: number,
    productId: string,
    userId: string,
  ) {
    const product = await this.productService.findOne(productId);

    const primaryImage =
      product.images.find((img) => img.isPrimary) || product.images[0];

    const caption = `
🍽️ *${product.name}*

${product.description || 'Sin descripción'}

💵 Precio: *Bs. ${product.price}*
    `;

    const keyboard = ProductKeyboard.productDetails(
      product.id,
      product.category,
    );

    if (primaryImage) {
      await this.telegramApi.sendPhoto(
        chatId,
        primaryImage.url,
        caption,
        keyboard,
      );
    } else {
      await this.telegramApi.sendMessage(chatId, caption, keyboard);
    }
  }

  /**
   * Agregar producto al carrito
   */
  async handleAddToCart(chatId: number, userId: string, productId: string) {
    try {
      await this.cartService.addItem(userId, {
        productId,
        quantity: 1,
      });

      const itemCount = await this.cartService.getItemCount(userId);

      await this.telegramApi.sendMessage(
        chatId,
        `✅ Producto agregado al carrito\n\n🛒 Tienes ${itemCount} items en tu carrito`,
        ProductKeyboard.afterAddToCart(),
      );
    } catch (error) {
      await this.telegramApi.sendMessage(
        chatId,
        '❌ Error al agregar producto al carrito',
      );
    }
  }
}
