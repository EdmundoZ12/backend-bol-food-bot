import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CartItem } from '../../cart/entities/cart-item.entity';
import { ProductImage } from './product-image.entity';
import { OrderItem } from '../../order/entities/order-item.entity';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column('text')
  category: string;

  @Column({ type: 'boolean', default: true })
  available: boolean;

  @OneToMany(() => CartItem, (cartItem) => cartItem.product)
  cartItems: CartItem[];

  @OneToMany(() => ProductImage, (image) => image.product, {
    onDelete: 'CASCADE',
  })
  images: ProductImage[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product, {
    onDelete: 'CASCADE',
  })
  orderItems: OrderItem[];
}
