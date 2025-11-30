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

    @Column({ type: 'float' })
    latitude: number;

    @Column({ type: 'float' })
    longitude: number;

    @CreateDateColumn()
    timestamp: Date;

    @ManyToOne(() => Driver, (driver) => driver.id, { onDelete: 'CASCADE' })
    driver: Driver;
}
