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

export enum OrderStatus {
  PENDING = 'PENDING', // Pedido creado, esperando confirmación
  CONFIRMED = 'CONFIRMED', // Cliente confirmó pago/ubicación
  SEARCHING_DRIVER = 'SEARCHING_DRIVER', // Buscando conductor
  ASSIGNED = 'ASSIGNED', // Conductor asignado, esperando aceptación
  ACCEPTED = 'ACCEPTED', // Conductor aceptó
  PICKING_UP = 'PICKING_UP', // Conductor va al restaurante
  PICKED_UP = 'PICKED_UP', // Conductor recogió el pedido
  IN_TRANSIT = 'IN_TRANSIT', // Conductor va al cliente
  AT_PLACE = 'AT_PLACE', // Conductor llegó a la puerta del cliente
  DELIVERED = 'DELIVERED', // Entregado
  CANCELLED = 'CANCELLED', // Cancelado
  REJECTED = 'REJECTED', // Rechazado por todos los conductores
}

export enum PaymentMethod {
  CASH = 'CASH',
  QR = 'QR',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('order')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float' })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

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

  // Nuevos campos para tracking y ganancias
  @Column({ type: 'float', nullable: true })
  deliveryDistance: number | null; // Distancia en km

  @Column({ type: 'float', nullable: true })
  deliveryFee: number | null; // Costo del delivery para el cliente

  @Column({ type: 'float', nullable: true })
  driverEarnings: number | null; // Ganancia del conductor

  @Column({ type: 'int', default: 0 })
  assignmentAttempts: number; // Intentos de asignación

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date | null; // Cuando se asignó al conductor

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null; // Cuando el conductor aceptó

  @Column({ type: 'timestamp', nullable: true })
  pickedUpAt: Date | null; // Cuando recogió el pedido

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null; // Cuando entregó

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
