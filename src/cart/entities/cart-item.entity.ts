import { Cart } from './cart.entity';
import { Product } from '../../product/entities/product.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('cart_item')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'float' })
  unitPrice: number;

  @Column({ type: 'float' })
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => Cart, (cart) => cart.cartItems, {
    onDelete: 'CASCADE',
  })
  cart: Cart;

  @ManyToOne(() => Product, (product) => product.cartItems, {
    eager: true, // ← Para cargar el producto automáticamente con sus imágenes
  })
  product: Product;
}
