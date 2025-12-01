import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EarningsService {
    constructor(private configService: ConfigService) { }

    /**
     * Calcula la ganancia del driver
     * GANANCIA = PRECIO_BASE + (DISTANCIA_KM × PRECIO_POR_KM)
     * 
     * Valores configurados:
     * - Precio base: Bs. 15
     * - Precio por km: Bs. 1
     */
    calculateDriverEarnings(distanceKm: number): number {
        const basePrice = parseFloat(
            this.configService.get<string>('DELIVERY_BASE_PRICE', '15'),
        );
        const pricePerKm = parseFloat(
            this.configService.get<string>('DELIVERY_PRICE_PER_KM', '1'),
        );

        const earnings = basePrice + distanceKm * pricePerKm;
        return Math.round(earnings * 100) / 100; // Redondear a 2 decimales
    }
}
