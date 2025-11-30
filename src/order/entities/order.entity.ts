import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
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

  @Column({ type: 'float', nullable: true })
  driverEarnings: number | null;

  @Column({
    type: 'enum',
    enum: [
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'ACCEPTED',
      'PICKING_UP',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
      'CANCELLED',
    ],
    default: 'PENDING',
  })
  status: string;

  @Column({ type: 'enum', enum: ['CASH', 'QR'], nullable: true })
  paymentMethod: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  paymentStatus: string;

  @Column({ type: 'text', nullable: true })
  deliveryAddress: string | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-array', nullable: true })
  rejectedDriverIds: string[];

  @ManyToOne(() => Driver, (driver) => driver.orders, {
    nullable: true,
  })
  driver: Driver | null;

  @ManyToOne(() => User, (user) => user.orders)
  user: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
    eager: true,
  })
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
