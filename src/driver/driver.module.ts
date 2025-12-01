import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { Order } from '../order/entities/order.entity';
import { DriverAssignmentService } from './services/driver-assignment.service';
import { DistanceService } from '../order/services/distance.service';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, DriverLocation, Order])],
  controllers: [DriverController],
  providers: [DriverService, DriverAssignmentService, DistanceService],
  exports: [TypeOrmModule, DriverService, DriverAssignmentService],
})
export class DriverModule { }
