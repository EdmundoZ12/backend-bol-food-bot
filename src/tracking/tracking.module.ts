import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingGateway } from './tracking.gateway';
import { DriverLocation } from '../driver/entities/driver-location.entity';
import { Driver } from '../driver/entities/driver.entity';

@Module({
    imports: [TypeOrmModule.forFeature([DriverLocation, Driver])],
    providers: [TrackingGateway],
    exports: [TrackingGateway],
})
export class TrackingModule { }
