import { Injectable } from '@nestjs/common';
import { TelegramApiUtil } from '../utils/telegram-api.util';
import { ProductService } from '../../product/product.service';
import { MainKeyboard } from '../keyboards/main.keyboard';
import { ProductKeyboard } from '../keyboards/product.keyboard';

@Injectable()
export class MenuHandler {
  constructor(
    private readonly telegramApi: TelegramApiUtil,
    private readonly productService: ProductService,
  ) {}

  /**
   * Mostrar categorías del menú
   */
  async handleMenu(chatId: number) {
    const categories = await this.productService.getCategories();

    await this.telegramApi.sendMessage(
      chatId,
      '🍽️ *MENÚ*\n\n¿Qué categoría te interesa?',
      MainKeyboard.categories(categories),
    );
  }

  /**
   * Mostrar productos de una categoría
   */
  async handleCategorySelection(chatId: number, category: string) {
    const products = await this.productService.findByCategory(category);

    if (products.length === 0) {
      await this.telegramApi.sendMessage(
        chatId,
        'No hay productos disponibles en esta categoría.',
      );
      return;
    }

    const message = `🍽️ *${category.toUpperCase()}*\n\nSelecciona un producto:`;

    await this.telegramApi.sendMessage(
      chatId,
      message,
      ProductKeyboard.productList(products, category),
    );
  }
}
