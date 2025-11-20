export class CartKeyboard {
  static cart() {
    return {
      inline_keyboard: [
        [{ text: '✅ Confirmar Pedido', callback_data: 'checkout' }],
        [{ text: '🛍️ Seguir Comprando', callback_data: 'view_menu' }],
      ],
    };
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
