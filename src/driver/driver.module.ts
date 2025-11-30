import { Module, forwardRef } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { OrderModule } from '../order/order.module';
import { DriverLocationGateway } from './driver-location/driver-location.gateway';

@Module({
  controllers: [DriverController],
  imports: [
    TypeOrmModule.forFeature([Driver, DriverLocation]),
    forwardRef(() => OrderModule),
  ],
  providers: [DriverService, DriverLocationGateway],
  exports: [TypeOrmModule, DriverService],
})
export class DriverModule { }
