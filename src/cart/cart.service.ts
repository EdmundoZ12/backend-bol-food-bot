import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ProductService } from '../product/product.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly productService: ProductService,
  ) {}

  /**
   * Obtener o crear carrito activo para un usuario
   */
  async getOrCreateCart(userId: string): Promise<Cart> {
    // Buscar carrito más reciente del usuario
    let cart = await this.cartRepository.findOne({
      where: { user: { telegramId: userId } },
      relations: ['cartItems', 'cartItems.product', 'cartItems.product.images'],
      order: { createdAt: 'DESC' },
    });

    // Si no existe, crear uno nuevo
    if (!cart) {
      cart = this.cartRepository.create({
        user: { telegramId: userId },
      });
      await this.cartRepository.save(cart);
    }

    return cart;
  }

  /**
   * Obtener carrito con items
   */
  async getCartWithItems(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { user: { telegramId: userId } },
      relations: ['cartItems', 'cartItems.product', 'cartItems.product.images'],
      order: { createdAt: 'DESC' },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  /**
   * Agregar item al carrito
   */
  async addItem(userId: string, addToCartDto: AddToCartDto): Promise<Cart> {
    const { productId, quantity, notes } = addToCartDto;

    // Verificar que el producto existe y está disponible
    const product = await this.productService.findOne(productId);

    if (!product.available) {
      throw new BadRequestException('Product is not available');
    }

    // Obtener o crear carrito
    const cart = await this.getOrCreateCart(userId);

    // Verificar si el producto ya está en el carrito
    const existingItem = cart.cartItems.find(
      (item) => item.product.id === productId,
    );

    if (existingItem) {
      // Si ya existe, incrementar cantidad
      existingItem.quantity += quantity;
      existingItem.subtotal = existingItem.quantity * product.price;

      if (notes) {
        existingItem.notes = notes;
      }

      await this.cartItemRepository.save(existingItem);
    } else {
      // Si no existe, crear nuevo item
      const cartItem = this.cartItemRepository.create({
        cart,
        product,
        quantity,
        unitPrice: product.price,
        subtotal: quantity * product.price,
        notes,
      });

      await this.cartItemRepository.save(cartItem);
    }

    // Retornar carrito actualizado
    return this.getCartWithItems(userId);
  }

  /**
   * Actualizar cantidad de un item
   */
  async updateItemQuantity(
    cartItemId: string,
    quantity: number,
  ): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    // Actualizar cantidad y subtotal
    cartItem.quantity = quantity;
    cartItem.subtotal = quantity * cartItem.product.price;

    return this.cartItemRepository.save(cartItem);
  }

  /**
   * Incrementar cantidad de un item
   */
  async incrementItem(cartItemId: string): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    cartItem.quantity += 1;
    cartItem.subtotal = cartItem.quantity * cartItem.product.price;

    return this.cartItemRepository.save(cartItem);
  }

  /**
   * Decrementar cantidad de un item
   */
  async decrementItem(cartItemId: string): Promise<CartItem | null> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.quantity <= 1) {
      // Si la cantidad es 1, eliminar el item
      await this.cartItemRepository.remove(cartItem);
      return null;
    }

    cartItem.quantity -= 1;
    cartItem.subtotal = cartItem.quantity * cartItem.product.price;

    return this.cartItemRepository.save(cartItem);
  }

  /**
   * Eliminar item del carrito
   */
  async removeItem(cartItemId: string): Promise<void> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);
  }

  /**
   * Actualizar notas de un item
   */
  async updateItemNotes(cartItemId: string, notes: string): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    cartItem.notes = notes;
    return this.cartItemRepository.save(cartItem);
  }

  /**
   * Calcular total del carrito
   */
  async calculateTotal(userId: string): Promise<number> {
    const cart = await this.getCartWithItems(userId);

    return cart.cartItems.reduce((total, item) => total + item.subtotal, 0);
  }

  /**
   * Contar items en el carrito
   */
  async getItemCount(userId: string): Promise<number> {
    const cart = await this.getOrCreateCart(userId);
    return cart.cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  /**
   * Verificar si el carrito está vacío
   */
  async isEmpty(userId: string): Promise<boolean> {
    const cart = await this.getOrCreateCart(userId);
    return cart.cartItems.length === 0;
  }

  /**
   * Vaciar carrito
   */
  async clearCart(userId: string): Promise<void> {
    const cart = await this.getCartWithItems(userId);

    if (cart.cartItems.length > 0) {
      await this.cartItemRepository.remove(cart.cartItems);
    }
  }

  /**
   * Eliminar carrito completo
   */
  async deleteCart(cartId: string): Promise<void> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.cartRepository.remove(cart);
  }

  /**
   * Obtener resumen del carrito (para mostrar en el bot)
   */
  async getCartSummary(userId: string): Promise<{
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      notes?: string;
    }>;
    totalItems: number;
    totalAmount: number;
  }> {
    const cart = await this.getCartWithItems(userId);

    const items = cart.cartItems.map((item) => ({
      id: item.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      notes: item.notes,
    }));

    const totalItems = cart.cartItems.reduce(
      (count, item) => count + item.quantity,
      0,
    );

    const totalAmount = cart.cartItems.reduce(
      (total, item) => total + item.subtotal,
      0,
    );

    return {
      items,
      totalItems,
      totalAmount,
    };
  }

  /**
   * Validar carrito antes de checkout
   */
  async validateCart(userId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const cart = await this.getCartWithItems(userId);
    const errors: string[] = [];

    if (cart.cartItems.length === 0) {
      errors.push('Cart is empty');
      return { valid: false, errors };
    }

    // Verificar disponibilidad de productos
    for (const item of cart.cartItems) {
      const isAvailable = await this.productService.isAvailable(
        item.product.id,
      );

      if (!isAvailable) {
        errors.push(`Product "${item.product.name}" is no longer available`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
