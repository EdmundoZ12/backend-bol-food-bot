import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../order/entities/order.entity';
import { Driver } from '../driver/entities/driver.entity';
import { User } from '../user/entities/user.entity';

import { DistanceService } from './services/distance.service';
import { PricingService } from './services/pricing.service';
import { FirebaseService } from './services/firebase.service';
import { OrderAssignmentService } from './services/order-assignment.service';
import { DriverStatsService } from './services/driver-stats.service';
import { TelegramNotificationService } from './services/telegram-notification.service';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order, Driver, User])],
  providers: [
    DistanceService,
    PricingService,
    FirebaseService,
    OrderAssignmentService,
    DriverStatsService,
    TelegramNotificationService,
  ],
  exports: [
    DistanceService,
    PricingService,
    FirebaseService,
    OrderAssignmentService,
    DriverStatsService,
    TelegramNotificationService,
  ],
})
export class CommonModule {}
