import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DistanceService } from '../common/services/distance.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
    private readonly distanceService: DistanceService,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const existingDriver = await this.findByEmail(createDriverDto.email);
    if (existingDriver) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(createDriverDto.password, 10);

    const driver = this.driverRepository.create({
      ...createDriverDto,
      password: hashedPassword,
    });

    return this.driverRepository.save(driver);
  }

  async findAll(): Promise<Driver[]> {
    return this.driverRepository.find({
      select: [
        'id',
        'email',
        'name',
        'lastname',
        'phone',
        'vehicle',
        'status',
        'isActive',
        'lastLatitude',
        'lastLongitude',
        'lastLocationUpdate',
        'createdAt',
      ],
    });
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({
      where: { id },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return driver;
  }

  async findByEmail(email: string): Promise<Driver | null> {
    return this.driverRepository.findOne({
      where: { email },
    });
  }

  async findByEmailWithPassword(email: string): Promise<Driver | null> {
    return this.driverRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'password',
        'name',
        'lastname',
        'phone',
        'vehicle',
        'status',
        'isActive',
        'appToken',
      ],
    });
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    const driver = await this.findOne(id);

    if (updateDriverDto.password) {
      updateDriverDto.password = await bcrypt.hash(
        updateDriverDto.password,
        10,
      );
    }

    Object.assign(driver, updateDriverDto);
    return this.driverRepository.save(driver);
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const driver = await this.findOne(id);
    driver.status = status;
    return this.driverRepository.save(driver);
  }

  async updateAppToken(id: string, appToken: string | null): Promise<Driver> {
    const driver = await this.findOne(id);
    driver.appToken = appToken;
    return this.driverRepository.save(driver);
  }

  async remove(id: string): Promise<void> {
    const driver = await this.findOne(id);
    await this.driverRepository.remove(driver);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLocation(
    driverId: string,
    latitude: number,
    longitude: number,
    accuracy?: number,
    speed?: number,
    heading?: number,
  ): Promise<DriverLocation> {
    const driver = await this.findOne(driverId);

    driver.lastLatitude = latitude;
    driver.lastLongitude = longitude;
    driver.lastLocationUpdate = new Date();
    await this.driverRepository.save(driver);

    const location = this.driverLocationRepository.create({
      driver,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
    });

    return this.driverLocationRepository.save(location);
  }

  async findAvailableDriversSortedByDistance(): Promise<
    Array<Driver & { distanceToRestaurant: number }>
  > {
    const availableDrivers = await this.driverRepository.find({
      where: {
        status: DriverStatus.AVAILABLE,
        isActive: true,
      },
    });

    const driversWithDistance = availableDrivers
      .filter((driver) => driver.lastLatitude && driver.lastLongitude)
      .map((driver) => {
        const distanceToRestaurant =
          this.distanceService.calculateDistanceFromRestaurant(
            driver.lastLatitude!,
            driver.lastLongitude!,
          );
        return { ...driver, distanceToRestaurant };
      });

    driversWithDistance.sort(
      (a, b) => a.distanceToRestaurant - b.distanceToRestaurant,
    );

    return driversWithDistance;
  }

  async findNearestAvailableDriver(): Promise<
    (Driver & { distanceToRestaurant: number }) | null
  > {
    const drivers = await this.findAvailableDriversSortedByDistance();
    return drivers.length > 0 ? drivers[0] : null;
  }

  async findAvailableDriversExcluding(
    excludeIds: string[],
  ): Promise<Array<Driver & { distanceToRestaurant: number }>> {
    const allDrivers = await this.findAvailableDriversSortedByDistance();
    return allDrivers.filter((driver) => !excludeIds.includes(driver.id));
  }

  async getLastLocation(driverId: string): Promise<{
    latitude: number | null;
    longitude: number | null;
    lastUpdate: Date | null;
  }> {
    const driver = await this.findOne(driverId);
    return {
      latitude: driver.lastLatitude,
      longitude: driver.lastLongitude,
      lastUpdate: driver.lastLocationUpdate,
    };
  }
}
