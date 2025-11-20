import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Obtener carrito de un usuario
  @Get(':userId')
  getCart(@Param('userId') userId: string) {
    return this.cartService.getCartWithItems(userId);
  }

  // Obtener resumen del carrito
  @Get(':userId/summary')
  getCartSummary(@Param('userId') userId: string) {
    return this.cartService.getCartSummary(userId);
  }

  // Calcular total
  @Get(':userId/total')
  calculateTotal(@Param('userId') userId: string) {
    return this.cartService.calculateTotal(userId);
  }

  // Agregar item al carrito
  @Post(':userId/items')
  addItem(@Param('userId') userId: string, @Body() addToCartDto: AddToCartDto) {
    return this.cartService.addItem(userId, addToCartDto);
  }

  // Incrementar cantidad
  @Patch('items/:itemId/increment')
  incrementItem(@Param('itemId') itemId: string) {
    return this.cartService.incrementItem(itemId);
  }

  // Decrementar cantidad
  @Patch('items/:itemId/decrement')
  decrementItem(@Param('itemId') itemId: string) {
    return this.cartService.decrementItem(itemId);
  }

  // Actualizar cantidad
  @Patch('items/:itemId/quantity')
  updateQuantity(
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartService.updateItemQuantity(itemId, quantity);
  }

  // Eliminar item
  @Delete('items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.cartService.removeItem(itemId);
  }

  // Vaciar carrito
  @Delete(':userId/clear')
  clearCart(@Param('userId') userId: string) {
    return this.cartService.clearCart(userId);
  }

  // Validar carrito
  @Get(':userId/validate')
  validateCart(@Param('userId') userId: string) {
    return this.cartService.validateCart(userId);
  }
}
