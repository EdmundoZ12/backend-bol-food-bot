import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Driver, DriverStatus } from './entities/driver.entity';
import { Order } from '../order/entities/order.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) { }

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

  /**
   * Obtener estadísticas del driver
   */
  async getDriverStats(driverId: string) {
    const driver = await this.findOne(driverId);

    // Estadísticas del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await this.orderRepository.find({
      where: {
        driver: { id: driverId },
        deliveredAt: MoreThan(today),
        status: 'DELIVERED',
      },
    });

    const todayEarnings = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.driverEarnings?.toString() || '0'),
      0,
    );

    // Estadísticas totales
    const totalOrders = await this.orderRepository.count({
      where: {
        driver: { id: driverId },
        status: 'DELIVERED',
      },
    });

    const allOrders = await this.orderRepository.find({
      where: {
        driver: { id: driverId },
        status: 'DELIVERED',
      },
    });

    const totalEarnings = allOrders.reduce(
      (sum, order) => sum + parseFloat(order.driverEarnings?.toString() || '0'),
      0,
    );

    return {
      driver: {
        id: driver.id,
        name: driver.name,
        lastname: driver.lastname,
        status: driver.status,
      },
      today: {
        deliveries: todayOrders.length,
        earnings: Math.round(todayEarnings * 100) / 100,
      },
      total: {
        deliveries: totalOrders,
        earnings: Math.round(totalEarnings * 100) / 100,
      },
    };
  }
}
