import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { DriverLocation } from './driver-location.entity';

export enum DriverStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

@Entity('driver')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column('text')
  password: string;

  @Column('text')
  name: string;

  @Column('text')
  lastname: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column('text')
  vehicle: string;

  @Column({
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.OFFLINE,
  })
  status: DriverStatus;

  @Column({ type: 'text', nullable: true })
  appToken: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Última ubicación conocida (para búsqueda rápida)
  @Column({ type: 'float', nullable: true })
  lastLatitude: number | null;

  @Column({ type: 'float', nullable: true })
  lastLongitude: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLocationUpdate: Date | null;

  @OneToMany(() => Order, (order) => order.driver)
  orders: Order[];

  @OneToMany(() => DriverLocation, (location) => location.driver)
  locations: DriverLocation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
