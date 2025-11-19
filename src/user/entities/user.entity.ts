import { Cart } from 'src/cart/entities/cart.entity';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Order } from '../../order/entities/order.entity';

@Entity('user')
export class User {
  @PrimaryColumn()
  telegramId: string;

  @Column('text', { unique: true })
  username: string;

  @Column()
  phone: string;

  @OneToMany(() => Cart, (cart) => cart.user)
  carts: Cart[];

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];
}
