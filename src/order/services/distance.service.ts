import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface DistanceMatrixResponse {
    rows: Array<{
        elements: Array<{
            distance?: { value: number; text: string };
            duration?: { value: number; text: string };
            status: string;
        }>;
    }>;
    status: string;
}

@Injectable()
export class DistanceService {
    private readonly googleMapsApiKey: string;

    constructor(private configService: ConfigService) {
        this.googleMapsApiKey = this.configService.get<string>(
            'GOOGLE_MAPS_API_KEY',
            '',
        );
    }

    /**
     * Calcula la distancia entre dos puntos usando Google Maps Distance Matrix API
     * @returns Distancia en kilómetros y tiempo estimado en minutos
     */
    async calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): Promise<{ distanceKm: number; durationMinutes: number }> {
        if (!this.googleMapsApiKey) {
            console.warn(
                '⚠️ Google Maps API Key no configurada, usando cálculo Haversine',
            );
            const distanceKm = this.calculateHaversineDistance(lat1, lon1, lat2, lon2);
            return {
                distanceKm,
                durationMinutes: Math.round((distanceKm / 30) * 60), // Estimación: 30 km/h promedio
            };
        }

        try {
            const origin = `${lat1},${lon1}`;
            const destination = `${lat2},${lon2}`;

            const response = await axios.get<DistanceMatrixResponse>(
                'https://maps.googleapis.com/maps/api/distancematrix/json',
                {
                    params: {
                        origins: origin,
                        destinations: destination,
                        mode: 'driving', // Modo de transporte: driving, walking, bicycling, transit
                        key: this.googleMapsApiKey,
                    },
                    timeout: 5000, // 5 segundos de timeout
                },
            );

            if (response.data.status !== 'OK') {
                throw new Error(`Google Maps API error: ${response.data.status}`);
            }

            const element = response.data.rows[0]?.elements[0];

            if (!element || element.status !== 'OK') {
                throw new Error(`No route found: ${element?.status}`);
            }

            const distanceMeters = element.distance?.value || 0;
            const durationSeconds = element.duration?.value || 0;

            const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
            const durationMinutes = Math.round(durationSeconds / 60);

            console.log(
                `📍 Google Maps: ${distanceKm} km, ${durationMinutes} min (${element.distance?.text}, ${element.duration?.text})`,
            );

            return {
                distanceKm,
                durationMinutes,
            };
        } catch (error) {
            console.error('❌ Error con Google Maps API:', error.message);
            console.log('⚠️ Usando cálculo Haversine como fallback');

            // Fallback a Haversine si Google Maps falla
            const distanceKm = this.calculateHaversineDistance(lat1, lon1, lat2, lon2);
            return {
                distanceKm,
                durationMinutes: Math.round((distanceKm / 30) * 60),
            };
        }
    }

    /**
     * Cálculo de distancia usando fórmula de Haversine (fallback)
     * @returns Distancia en kilómetros
     */
    private calculateHaversineDistance(
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

        return Math.round(distance * 100) / 100;
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}
