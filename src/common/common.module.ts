import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistanceService } from './services/distance.service';
import { PricingService } from './services/pricing.service';
import { GoogleMapsService } from './services/google-maps.service';
import { FirebaseService } from './services/firebase.service';
import { OrderAssignmentService } from './services/order-assignment.service';
import { Order } from '../order/entities/order.entity';
import { Driver } from '../driver/entities/driver.entity';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order, Driver])],
  providers: [
    DistanceService,
    PricingService,
    GoogleMapsService,
    FirebaseService,
    OrderAssignmentService,
  ],
  exports: [
    DistanceService,
    PricingService,
    GoogleMapsService,
    FirebaseService,
    OrderAssignmentService,
  ],
})
export class CommonModule {}
