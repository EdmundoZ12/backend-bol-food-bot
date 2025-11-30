import axios from 'axios';

/**
 * Calculadora de distancias usando EXCLUSIVAMENTE Google Maps Distance Matrix API
 * Considera calles reales, tráfico y rutas urbanas
 */
export class DistanceCalculator {
    private static readonly GOOGLE_MAPS_API_URL =
        'https://maps.googleapis.com/maps/api/distancematrix/json';

    /**
     * Calcula la distancia REAL entre dos puntos usando Google Maps
     * Considera calles, tráfico y rutas reales
     * @param lat1 Latitud del punto origen
     * @param lon1 Longitud del punto origen
     * @param lat2 Latitud del punto destino
     * @param lon2 Longitud del punto destino
     * @param apiKey API Key de Google Maps
     * @returns Objeto con distancia en metros, km y duración estimada
     * @throws Error si Google Maps API falla
     */
    static async calculateRealDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
        apiKey: string,
    ): Promise<{
        distanceMeters: number;
        distanceKm: number;
        durationSeconds: number;
        durationMinutes: number;
    }> {
        if (!apiKey) {
            throw new Error(
                'Google Maps API Key no configurada. Agrega GOOGLE_MAPS_API_KEY al archivo .env',
            );
        }

        try {
            const origin = `${lat1},${lon1}`;
            const destination = `${lat2},${lon2}`;

            const response = await axios.get(this.GOOGLE_MAPS_API_URL, {
                params: {
                    origins: origin,
                    destinations: destination,
                    mode: 'driving', // Modo: driving, walking, bicycling, transit
                    key: apiKey,
                    language: 'es',
                },
                timeout: 10000, // 10 segundos timeout
            });

            if (response.data.status !== 'OK') {
                throw new Error(
                    `Google Maps API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`,
                );
            }

            const element = response.data.rows[0]?.elements[0];

            if (!element || element.status !== 'OK') {
                throw new Error(
                    `No se pudo calcular la ruta entre los puntos. Status: ${element?.status || 'Unknown'}`,
                );
            }

            const distanceMeters = element.distance.value; // Distancia en metros
            const durationSeconds = element.duration.value; // Duración en segundos

            return {
                distanceMeters,
                distanceKm: Math.round(distanceMeters / 10) / 100, // Convertir a km con 2 decimales
                durationSeconds,
                durationMinutes: Math.round(durationSeconds / 60), // Convertir a minutos
            };
        } catch (error: any) {
            // Lanzar error sin fallback
            if (error.response) {
                throw new Error(
                    `Error de Google Maps API: ${error.response.status} - ${error.response.data?.error_message || error.message}`,
                );
            } else if (error.request) {
                throw new Error(
                    'No se pudo conectar con Google Maps API. Verifica tu conexión a internet.',
                );
            } else {
                throw new Error(`Error calculando distancia: ${error.message}`);
            }
        }
    }
}
