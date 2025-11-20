import { Product } from '../../product/entities/product.entity';

export class ProductKeyboard {
  static productList(products: Product[], category: string) {
    return {
      inline_keyboard: [
        ...products.map((product) => [
          {
            text: `${product.name} - Bs. ${product.price}`,
            callback_data: `product_${product.id}`,
          },
        ]),
        [{ text: '⬅️ Volver al Menú', callback_data: 'view_menu' }],
      ],
    };
  }

  static productDetails(productId: string, category: string) {
    return {
      inline_keyboard: [
        [
          {
            text: '🛒 Agregar al Carrito',
            callback_data: `add_to_cart_${productId}`,
          },
        ],
        [{ text: '⬅️ Volver', callback_data: `category_${category}` }],
      ],
    };
  }

  static afterAddToCart() {
    return {
      inline_keyboard: [
        [{ text: '🛒 Ver Carrito', callback_data: 'view_cart' }],
        [{ text: '🍽️ Seguir Comprando', callback_data: 'view_menu' }],
      ],
    };
  }
}
