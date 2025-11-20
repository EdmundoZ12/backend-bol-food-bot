export class CartKeyboard {
  /**
   * Teclado principal del carrito con items individuales
   */
  static cart(items: Array<{ id: string; productName: string; quantity: number }>) {
    const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    // Botones para cada producto (incrementar/decrementar)
    items.forEach((item) => {
      keyboard.push([
        { text: `${item.productName} (${item.quantity})`, callback_data: `cart_info_${item.id}` },
      ]);
      keyboard.push([
        { text: '➖', callback_data: `cart_decr_${item.id}` },
        { text: `${item.quantity}`, callback_data: `cart_noop_${item.id}` },
        { text: '➕', callback_data: `cart_incr_${item.id}` },
        { text: '🗑️', callback_data: `cart_remove_${item.id}` },
      ]);
    });

    // Botones de acción
    keyboard.push([{ text: '✅ Confirmar Pedido', callback_data: 'checkout' }]);
    keyboard.push([{ text: '🛍️ Seguir Comprando', callback_data: 'view_menu' }]);
    keyboard.push([{ text: '🗑️ Vaciar Carrito', callback_data: 'clear_cart' }]);

    return { inline_keyboard: keyboard };
  }

  static emptyCart() {
    return {
      inline_keyboard: [[{ text: '🍽️ Ver Menú', callback_data: 'view_menu' }]],
    };
  }

  static checkout() {
    return {
      inline_keyboard: [
        [{ text: '⏭️ Omitir', callback_data: 'skip_notes' }],
        [{ text: '💬 Agregar Nota', callback_data: 'add_notes' }],
      ],
    };
  }

  static paymentMethod() {
    return {
      inline_keyboard: [
        [{ text: '📱 Pagar con QR', callback_data: 'payment_QR' }],
        [{ text: '💵 Pagar en Efectivo', callback_data: 'payment_CASH' }],
      ],
    };
  }

  static confirmQRPayment() {
    return {
      inline_keyboard: [
        [{ text: '✅ Ya Pagué', callback_data: 'confirm_qr_payment' }],
      ],
    };
  }

  static shareLocation() {
    return {
      inline_keyboard: [
        [{ text: '📍 Compartir Ubicación', callback_data: 'share_location' }],
      ],
    };
  }

  static addressReference() {
    return {
      inline_keyboard: [
        [{ text: '⏭️ Omitir', callback_data: 'skip_address_reference' }],
        [
          {
            text: '✏️ Agregar Referencia',
            callback_data: 'add_address_reference',
          },
        ],
      ],
    };
  }

  static orderConfirmed() {
    return {
      inline_keyboard: [
        [{ text: '🏠 Volver al Inicio', callback_data: 'view_menu' }],
      ],
    };
  }
}
