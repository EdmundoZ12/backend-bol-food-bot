import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { UserModule } from '../user/user.module';
import { CartItem } from './entities/cart-item.entity';
import { ProductModule } from 'src/product/product.module';

@Module({
  controllers: [CartController],
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    UserModule,
    ProductModule,
  ],
  providers: [CartService],
  exports: [TypeOrmModule],
})
export class CartModule {}
