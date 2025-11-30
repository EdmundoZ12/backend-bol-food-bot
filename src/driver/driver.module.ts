import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverService } from './driver.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { DriverController } from './driver.controller';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { OrderAssignmentHistory } from './entities/order-assignment-history.entity';
import { Order } from '../order/entities/order.entity';

@Module({
  controllers: [DriverController],
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      DriverLocation,
      OrderAssignmentHistory,
      Order,
    ]),
  ],
  providers: [DriverService, DriverAssignmentService],
  exports: [TypeOrmModule, DriverService, DriverAssignmentService],
})
export class DriverModule { }

