import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  TravelMode,
  UnitSystem,
} from '@googlemaps/google-maps-services-js';

export interface DistanceResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
}

@Injectable()
export class GoogleMapsService {
  private readonly client: Client;
  private readonly apiKey: string;
  private readonly logger = new Logger(GoogleMapsService.name);

  // Coordenadas del restaurante
  private readonly restaurantLat: number;
  private readonly restaurantLng: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';
    this.restaurantLat = parseFloat(
      this.configService.get<string>('RESTAURANT_LATITUDE') ||
        '-17.783294883950212',
    );
    this.restaurantLng = parseFloat(
      this.configService.get<string>('RESTAURANT_LONGITUDE') ||
        '-63.18213281010442',
    );
  }

  /**
   * Calcular distancia y tiempo entre dos puntos
   */
  async getDistanceAndDuration(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceResult | null> {
    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [`${originLat},${originLng}`],
          destinations: [`${destLat},${destLng}`],
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          key: this.apiKey,
        },
      });

      const result = response.data.rows[0]?.elements[0];

      if (result?.status === 'OK') {
        return {
          distanceKm: result.distance.value / 1000,
          distanceText: result.distance.text,
          durationMinutes: Math.ceil(result.duration.value / 60),
          durationText: result.duration.text,
        };
      }

      this.logger.warn(
        `Distance Matrix API returned status: ${result?.status}`,
      );
      return null;
    } catch (error) {
      this.logger.error('Error calling Distance Matrix API', error);
      return null;
    }
  }

  /**
   * Calcular distancia y tiempo desde el restaurante hasta un punto
   */
  async getDistanceFromRestaurant(
    destLat: number,
    destLng: number,
  ): Promise<DistanceResult | null> {
    return this.getDistanceAndDuration(
      this.restaurantLat,
      this.restaurantLng,
      destLat,
      destLng,
    );
  }

  /**
   * Calcular distancia y tiempo desde un punto hasta el restaurante
   */
  async getDistanceToRestaurant(
    originLat: number,
    originLng: number,
  ): Promise<DistanceResult | null> {
    return this.getDistanceAndDuration(
      originLat,
      originLng,
      this.restaurantLat,
      this.restaurantLng,
    );
  }

  /**
   * Obtener distancias de múltiples orígenes a un destino
   * Útil para encontrar el driver más cercano
   */
  async getDistancesFromMultipleOrigins(
    origins: Array<{ id: string; lat: number; lng: number }>,
    destLat: number,
    destLng: number,
  ): Promise<Array<{ id: string; distance: DistanceResult | null }>> {
    if (origins.length === 0) {
      return [];
    }

    try {
      const originStrings = origins.map((o) => `${o.lat},${o.lng}`);

      const response = await this.client.distancematrix({
        params: {
          origins: originStrings,
          destinations: [`${destLat},${destLng}`],
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          key: this.apiKey,
        },
      });

      return origins.map((origin, index) => {
        const result = response.data.rows[index]?.elements[0];

        if (result?.status === 'OK') {
          return {
            id: origin.id,
            distance: {
              distanceKm: result.distance.value / 1000,
              distanceText: result.distance.text,
              durationMinutes: Math.ceil(result.duration.value / 60),
              durationText: result.duration.text,
            },
          };
        }

        return { id: origin.id, distance: null };
      });
    } catch (error) {
      this.logger.error(
        'Error calling Distance Matrix API for multiple origins',
        error,
      );
      return origins.map((o) => ({ id: o.id, distance: null }));
    }
  }

  /**
   * Encontrar el driver más cercano al restaurante
   */
  async findNearestToRestaurant(
    drivers: Array<{ id: string; lat: number; lng: number }>,
  ): Promise<{ id: string; distance: DistanceResult } | null> {
    const results = await this.getDistancesFromMultipleOrigins(
      drivers,
      this.restaurantLat,
      this.restaurantLng,
    );

    // Filtrar los que tienen distancia válida y ordenar
    const validResults = results
      .filter((r) => r.distance !== null)
      .sort(
        (a, b) => a.distance!.durationMinutes - b.distance!.durationMinutes,
      );

    if (validResults.length === 0) {
      return null;
    }

    return {
      id: validResults[0].id,
      distance: validResults[0].distance!,
    };
  }

  /**
   * Calcular tiempo total de entrega (driver -> restaurante -> cliente)
   */
  async calculateTotalDeliveryTime(
    driverLat: number,
    driverLng: number,
    clientLat: number,
    clientLng: number,
  ): Promise<{
    driverToRestaurant: DistanceResult | null;
    restaurantToClient: DistanceResult | null;
    totalMinutes: number;
    totalText: string;
  }> {
    const [driverToRestaurant, restaurantToClient] = await Promise.all([
      this.getDistanceToRestaurant(driverLat, driverLng),
      this.getDistanceFromRestaurant(clientLat, clientLng),
    ]);

    const preparationTime = 10; // 10 minutos de preparación estimados

    const driverTime = driverToRestaurant?.durationMinutes || 0;
    const deliveryTime = restaurantToClient?.durationMinutes || 0;
    const totalMinutes = driverTime + preparationTime + deliveryTime;

    return {
      driverToRestaurant,
      restaurantToClient,
      totalMinutes,
      totalText: `${totalMinutes} min aproximadamente`,
    };
  }
}
