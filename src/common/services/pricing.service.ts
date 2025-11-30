import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PricingService {
  private readonly basePrice: number;
  private readonly pricePerKm: number;

  constructor(private readonly configService: ConfigService) {
    this.basePrice = parseFloat(
      this.configService.get<string>('DELIVERY_BASE_PRICE') || '15',
    );
    this.pricePerKm = parseFloat(
      this.configService.get<string>('DELIVERY_PRICE_PER_KM') || '0.80',
    );
  }

  /**
   * Calcular ganancia del conductor basado en distancia en km
   * Fórmula: 15 Bs base + (km × 0.80 Bs)
   */
  calculateDriverEarnings(distanceKm: number): number {
    const earnings = this.basePrice + distanceKm * this.pricePerKm;
    return Math.round(earnings * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Calcular tarifa de delivery para el cliente
   * Por ahora es igual a la ganancia del conductor
   */
  calculateDeliveryFee(distanceKm: number): number {
    return this.calculateDriverEarnings(distanceKm);
  }

  /**
   * Obtener desglose de precios
   */
  getPriceBreakdown(distanceKm: number): {
    basePrice: number;
    distancePrice: number;
    total: number;
    distanceKm: number;
  } {
    const distancePrice = Math.round(distanceKm * this.pricePerKm * 100) / 100;
    const total = this.calculateDriverEarnings(distanceKm);

    return {
      basePrice: this.basePrice,
      distancePrice,
      total,
      distanceKm: Math.round(distanceKm * 100) / 100,
    };
  }
}
