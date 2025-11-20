export class MainKeyboard {
  static welcome() {
    return {
      inline_keyboard: [
        [{ text: '🍽️ Ver Menú', callback_data: 'view_menu' }],
        [{ text: '🛒 Mi Carrito', callback_data: 'view_cart' }],
        [{ text: 'ℹ️ Ayuda', callback_data: 'help' }],
      ],
    };
  }

  static categories(categories: string[]) {
    return {
      inline_keyboard: categories.map((category) => [
        {
          text: `${this.getCategoryEmoji(category)} ${category}`,
          callback_data: `category_${category}`,
        },
      ]),
    };
  }

  private static getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      Pollos: '🍗',
      'Alitas de Pollo': '🍗',
      Hamburguesas: '🍔',
      'Pique Macho': '🍖',
      Lomitos: '🥖',
      Salchipapas: '🍟',
      Gaseosas: '🥤',
    };
    return emojis[category] || '🍽️';
  }
}
