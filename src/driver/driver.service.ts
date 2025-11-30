import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { calculateDistance } from '../common/utils/distance.util';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
  ) { }

  create(createDriverDto: CreateDriverDto) {
    const driver = this.driverRepository.create(createDriverDto);
    return this.driverRepository.save(driver);
  }

  findAll() {
    return this.driverRepository.find();
  }

  findOne(id: string) {
    return this.driverRepository.findOne({ where: { id } });
  }

  update(id: string, updateDriverDto: UpdateDriverDto) {
    return this.driverRepository.update(id, updateDriverDto);
  }

  remove(id: string) {
    return this.driverRepository.delete(id);
  }

  async findNearestAvailableDriver(
    lat: number,
    lon: number,
    excludedDriverIds: string[] = [],
  ): Promise<Driver | null> {
    // 1. Get all available drivers
    const availableDrivers = await this.driverRepository.find({
      where: { status: 'AVAILABLE' },
    });

    if (availableDrivers.length === 0) {
      return null;
    }

    let nearestDriver: Driver | null = null;
    let minDistance = Infinity;

    // 2. For each driver, get latest location and calculate distance
    for (const driver of availableDrivers) {
      // Skip if driver is excluded
      if (excludedDriverIds.includes(driver.id)) {
        continue;
      }

      const lastLocation = await this.driverLocationRepository.findOne({
        where: { driver: { id: driver.id } },
        order: { timestamp: 'DESC' },
      });

      if (lastLocation) {
        const distance = calculateDistance(
          lat,
          lon,
          lastLocation.latitude,
          lastLocation.longitude,
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestDriver = driver;
        }
      }
    }

    return nearestDriver;
  }
}
