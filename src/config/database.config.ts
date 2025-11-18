import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Product } from '../product/entities/product.entity';
import { Driver } from '../driver/entities/driver.entity';
import { Cart } from '../cart/entities/cart.entity';
import { Order } from '../order/entities/order.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'TesloDB',
  entities: [User, Product, Driver, Cart, Order],
  synchronize: true, // TEMPORAL: crear tablas en producción
  logging: process.env.NODE_ENV === 'development',
  dropSchema: false,
  migrationsRun: false, // Deshabilitado temporalmente
});
