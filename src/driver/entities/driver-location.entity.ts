import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

@Entity('driver_location')
export class DriverLocation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'driver_id' })
    driverId: string;

    @ManyToOne(() => Driver)
    @JoinColumn({ name: 'driver_id' })
    driver: Driver;

    @Column('decimal', { precision: 10, scale: 8 })
    latitude: number;

    @Column('decimal', { precision: 11, scale: 8 })
    longitude: number;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'timestamp' })
    timestamp: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
