import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { CartModule } from '../cart/cart.module';
import { OrderModule } from '../order/order.module';

// Utils
import { TelegramApiUtil } from './utils/telegram-api.util';

// Handlers
import { StartHandler } from './handlers/start.handler';
import { MenuHandler } from './handlers/menu.handler';
import { ProductHandler } from './handlers/product.handler';
import { CartHandler } from './handlers/cart.handler';
import { CheckoutHandler } from './handlers/checkout.handler';

@Module({
  imports: [UserModule, ProductModule, CartModule, OrderModule],
  providers: [
    TelegramBotService,
    TelegramApiUtil, // ← Agregar aquí
    StartHandler,
    MenuHandler,
    ProductHandler,
    CartHandler,
    CheckoutHandler,
  ],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
