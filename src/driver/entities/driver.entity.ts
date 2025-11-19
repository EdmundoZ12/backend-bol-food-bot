import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from '../../order/entities/order.entity';

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

  @OneToMany(() => Order, (order) => order.driver, { onDelete: 'CASCADE' })
  orders: Order[];
}
