import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

@Entity('driver_location')
export class DriverLocation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Driver, { eager: true })
    driver: Driver;

    @Column({ type: 'decimal', precision: 10, scale: 6 })
    latitude: number;

    @Column({ type: 'decimal', precision: 10, scale: 6 })
    longitude: number;

    @CreateDateColumn()
    timestamp: Date;
}
