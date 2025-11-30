import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

@Entity('driver_location')
export class DriverLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ type: 'float', nullable: true })
  accuracy: number | null; // Precisión del GPS en metros

  @Column({ type: 'float', nullable: true })
  speed: number | null; // Velocidad en m/s

  @Column({ type: 'float', nullable: true })
  heading: number | null; // Dirección en grados

  @ManyToOne(() => Driver, (driver) => driver.locations, {
    onDelete: 'CASCADE',
  })
  driver: Driver;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
