import { Module } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';

@Module({
  controllers: [DriverController],
  imports: [TypeOrmModule.forFeature([Driver])],
  providers: [DriverService],
  exports: [TypeOrmModule],
})
export class DriverModule {}
