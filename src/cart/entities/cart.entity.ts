import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { CartItem } from './cart-item.entity';

@Entity('cart')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn() // ← Agregar para saber cuándo se modificó
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.carts, {
    onDelete: 'CASCADE',
  })
  user: User;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart, {
    cascade: true, // ← Para auto-guardar/eliminar items
    eager: true, // ← Para cargar items automáticamente
  })
  cartItems: CartItem[];
}
