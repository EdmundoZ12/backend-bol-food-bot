import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ProductModule } from '../product/product.module';
import { DriverModule } from '../driver/driver.module';
import { UserModule } from '../user/user.module';
import { CartModule } from '../cart/cart.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  controllers: [OrderController],
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    ProductModule,
    DriverModule,
    UserModule,
    CartModule,
    TelegramBotModule,
  ],
  providers: [OrderService],
  exports: [TypeOrmModule, OrderService],
})
export class OrderModule { }
