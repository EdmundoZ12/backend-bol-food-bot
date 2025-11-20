import { Cart } from 'src/cart/entities/cart.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

@Entity('user')
export class User {
  @PrimaryColumn({ type: 'bigint' }) // ← Telegram IDs son números grandes
  telegramId: string;

  @Column('text', { nullable: true }) // ← Nullable porque no todos tienen username
  username: string;

  @Column('text', { nullable: true }) // ← Nullable, se pedirá en el primer pedido
  firstName: string;

  @Column('text', { nullable: true })
  lastName: string;

  @Column('text', { nullable: true }) // ← Nullable, se pedirá al confirmar pedido
  phone: string;

  @Column({ type: 'boolean', default: true }) // ← Para saber si está activo
  isActive: boolean;

  @OneToMany(() => Cart, (cart) => cart.user, { cascade: true })
  carts: Cart[];

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date; // ← Fecha de registro

  @UpdateDateColumn()
  updatedAt: Date; // ← Última interacción
}
