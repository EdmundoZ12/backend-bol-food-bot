import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { DriverOrderController } from './driver-order.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, DriverLocation])],
  controllers: [DriverController, DriverOrderController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
