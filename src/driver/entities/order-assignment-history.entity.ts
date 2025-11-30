import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Driver } from './driver.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('order_assignment_history')
export class OrderAssignmentHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'order_id' })
    orderId: string;

    @ManyToOne(() => Order)
    @JoinColumn({ name: 'order_id' })
    order: Order;

    @Column({ name: 'driver_id' })
    driverId: string;

    @ManyToOne(() => Driver)
    @JoinColumn({ name: 'driver_id' })
    driver: Driver;

    @CreateDateColumn({ name: 'assigned_at' })
    assignedAt: Date;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'pending',
    })
    status: string; // 'pending', 'accepted', 'rejected'

    @Column({ name: 'rejected_at', nullable: true })
    rejectedAt: Date;

    @Column({ name: 'distance_meters', type: 'integer' })
    distanceMeters: number; // Distancia en metros

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
