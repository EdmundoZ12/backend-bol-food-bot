import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from '../../driver/entities/driver.entity';
import { User } from '../../user/entities/user.entity';
import { OrderItem } from './order-item.entity';

@Entity('order')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float' })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: [
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'INTRANSIT',
      'DELIVERED',
      'CANCELLED',
    ],
  })
  status: string;

  @Column({ type: 'enum', enum: ['CASH', 'QR'] })
  paymentMethod: string;

  @Column({ type: 'enum', enum: ['PENDING', 'COMPLETED', 'FAILED'] })
  paymentStatus: string;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Column({ type: 'float' })
  latitud: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'text' })
  notes: string;

  @ManyToOne(() => Driver, (driver) => driver.orders, { onDelete: 'CASCADE' })
  driver: Driver;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
  })
  orderItems: OrderItem[];
}
