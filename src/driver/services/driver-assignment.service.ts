import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from '../entities/driver.entity';
import { DriverLocation } from '../entities/driver-location.entity';
import { DistanceService } from '../../order/services/distance.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DriverAssignmentService {
    constructor(
        @InjectRepository(Driver)
        private driverRepository: Repository<Driver>,
        @InjectRepository(DriverLocation)
        private driverLocationRepository: Repository<DriverLocation>,
        private distanceService: DistanceService,
        private configService: ConfigService,
    ) { }

    /**
     * Encuentra el driver AVAILABLE más cercano al restaurante
     * @param excludeDriverIds IDs de drivers que ya rechazaron el pedido
     * @returns Driver más cercano o null si no hay disponibles
     */
    async findNearestAvailableDriver(
        excludeDriverIds: string[] = [],
    ): Promise<Driver | null> {
        const restaurantLat = parseFloat(
            this.configService.get<string>('RESTAURANT_LATITUDE', '-17.783777'),
        );
        const restaurantLon = parseFloat(
            this.configService.get<string>('RESTAURANT_LONGITUDE', '-63.181997'),
        );

        // Obtener todos los drivers AVAILABLE
        const availableDrivers = await this.driverRepository.find({
            where: {
                status: DriverStatus.AVAILABLE,
                isActive: true,
            },
        });

        if (availableDrivers.length === 0) {
            console.log('⚠️ No hay drivers disponibles');
            return null;
        }

        // Filtrar drivers excluidos (que ya rechazaron)
        const eligibleDrivers = availableDrivers.filter(
            (driver) => !excludeDriverIds.includes(driver.id),
        );

        if (eligibleDrivers.length === 0) {
            console.log('⚠️ Todos los drivers disponibles rechazaron el pedido');
            return null;
        }

        // Calcular distancia de cada driver al restaurante
        const driversWithDistance = await Promise.all(
            eligibleDrivers.map(async (driver) => {
                const lastLocation = await this.driverLocationRepository.findOne({
                    where: { driver: { id: driver.id } },
                    order: { timestamp: 'DESC' },
                });

                if (!lastLocation) {
                    console.log(`⚠️ Driver ${driver.id} no tiene ubicación registrada`);
                    return { driver, distance: Infinity, duration: 0 };
                }

                const driverLat = parseFloat(lastLocation.latitude.toString());
                const driverLon = parseFloat(lastLocation.longitude.toString());

                console.log(`🔍 DEBUG - Driver ${driver.name}:`);
                console.log(`   Restaurante: ${restaurantLat}, ${restaurantLon}`);
                console.log(`   Driver: ${driverLat}, ${driverLon}`);

                const result = await this.distanceService.calculateDistance(
                    restaurantLat,
                    restaurantLon,
                    driverLat,
                    driverLon,
                );

                return {
                    driver,
                    distance: result.distanceKm,
                    duration: result.durationMinutes
                };
            }),
        );

        // Ordenar por distancia y retornar el más cercano
        driversWithDistance.sort((a, b) => a.distance - b.distance);

        const nearest = driversWithDistance[0];

        if (nearest && nearest.distance !== Infinity) {
            console.log(
                `✅ Driver más cercano: ${nearest.driver.name} ${nearest.driver.lastname} (${nearest.distance} km, ${nearest.duration} min)`,
            );
            return nearest.driver;
        }

        return null;
    }
}
