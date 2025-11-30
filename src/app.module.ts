import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { DriverModule } from './driver/driver.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => databaseConfig(),
    }),
    CommonModule, // ← Agregar aquí
    UserModule,
    ProductModule,
    CartModule,
    OrderModule,
    DriverModule,
    CloudinaryModule,
    TelegramBotModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
