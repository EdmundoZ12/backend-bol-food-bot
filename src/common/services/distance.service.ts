import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DistanceService {
  private readonly restaurantLat: number;
  private readonly restaurantLng: number;

  constructor(private readonly configService: ConfigService) {
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
   * Calcular distancia entre dos puntos usando la fórmula de Haversine
   * @returns Distancia en kilómetros
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radio de la Tierra en km

    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Redondear a 2 decimales
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calcular distancia desde el restaurante hasta un punto
   */
  calculateDistanceFromRestaurant(lat: number, lng: number): number {
    return this.calculateDistance(
      this.restaurantLat,
      this.restaurantLng,
      lat,
      lng,
    );
  }

  /**
   * Obtener coordenadas del restaurante
   */
  getRestaurantCoordinates(): { latitude: number; longitude: number } {
    return {
      latitude: this.restaurantLat,
      longitude: this.restaurantLng,
    };
  }
}
