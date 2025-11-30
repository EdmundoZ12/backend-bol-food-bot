import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { DriverLocation } from './driver-location.entity';
import { OrderAssignmentHistory } from './order-assignment-history.entity';

@Entity('driver')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  appToken: string;

  @Column('text')
  name: string;

  @Column('text')
  lastname: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column('text')
  vehicle: string;

  @Column({ type: 'enum', enum: ['AVAILABLE', 'BUSY', 'OFFLINE'] })
  status: string;

  // Campos de ubicación para tracking
  @Column({
    name: 'current_latitude',
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
  })
  currentLatitude: number;

  @Column({
    name: 'current_longitude',
    type: 'decimal',
    precision: 11,
    scale: 8,
    nullable: true,
  })
  currentLongitude: number;

  @Column({ name: 'last_location_update', nullable: true })
  lastLocationUpdate: Date;

  // Telegram ID para notificaciones
  @Column({ name: 'telegram_id', nullable: true })
  telegramId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @OneToMany(() => Order, (order) => order.driver, { onDelete: 'CASCADE' })
  orders: Order[];

  @OneToMany(() => DriverLocation, (location) => location.driver)
  locations: DriverLocation[];

  @OneToMany(() => OrderAssignmentHistory, (assignment) => assignment.driver)
  assignmentHistory: OrderAssignmentHistory[];
}

