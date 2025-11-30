import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Driver } from './entities/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { DistanceCalculator } from './utils/distance-calculator';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
  ) { }

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const driver = this.driverRepository.create(createDriverDto);
    return await this.driverRepository.save(driver);
  }

  async findAll(): Promise<Driver[]> {
    return await this.driverRepository.find();
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Repartidor con ID ${id} no encontrado`);
    }
    return driver;
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    await this.driverRepository.update(id, updateDriverDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.driverRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Repartidor con ID ${id} no encontrado`);
    }
  }

  /**
   * Actualiza la ubicación de un repartidor
   */
  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
  ): Promise<Driver> {
    const driver = await this.findOne(id);

    // Actualizar ubicación actual en el driver
    driver.currentLatitude = latitude;
    driver.currentLongitude = longitude;
    driver.lastLocationUpdate = new Date();

    await this.driverRepository.save(driver);

    // Guardar en historial de ubicaciones
    const location = this.driverLocationRepository.create({
      driverId: id,
      latitude,
      longitude,
      isActive: true,
    });

    await this.driverLocationRepository.save(location);

    this.logger.log(
      `Ubicación actualizada para repartidor ${driver.name}: ${latitude}, ${longitude}`,
    );

    return driver;
  }

  /**
   * Encuentra repartidores cercanos a una ubicación
   */
  async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<
    Array<{
      driver: Driver;
      distanceMeters: number;
      distanceKm: number;
    }>
  > {
    // Obtener todos los repartidores disponibles con ubicación
    const drivers = await this.driverRepository.find({
      where: { status: 'AVAILABLE' },
    });

    // Filtrar solo los que tienen ubicación
    const driversWithLocation = drivers.filter(
      (d) => d.currentLatitude && d.currentLongitude,
    );

    // Calcular distancias
    const driversWithDistance = driversWithLocation
      .map((driver) => {
        const distanceMeters = DistanceCalculator.calculateDistanceInMeters(
          latitude,
          longitude,
          driver.currentLatitude,
          driver.currentLongitude,
        );

        return {
          driver,
          distanceMeters,
          distanceKm: Math.round(distanceMeters / 10) / 100,
        };
      })
      .filter((d) => d.distanceKm <= radiusKm) // Filtrar por radio
      .sort((a, b) => a.distanceMeters - b.distanceMeters); // Ordenar por distancia

    return driversWithDistance;
  }

  /**
   * Obtiene el historial de ubicaciones de un repartidor
   */
  async getLocationHistory(
    driverId: string,
    limit: number = 50,
  ): Promise<DriverLocation[]> {
    return await this.driverLocationRepository.find({
      where: { driverId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Actualiza el estado de un repartidor
   */
  async updateStatus(
    id: string,
    status: 'AVAILABLE' | 'BUSY' | 'OFFLINE',
  ): Promise<Driver> {
    const driver = await this.findOne(id);
    driver.status = status;
    return await this.driverRepository.save(driver);
  }
}

