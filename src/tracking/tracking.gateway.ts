import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverLocation } from '../driver/entities/driver-location.entity';
import { Driver } from '../driver/entities/driver.entity';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class TrackingGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        @InjectRepository(DriverLocation)
        private driverLocationRepository: Repository<DriverLocation>,
        @InjectRepository(Driver)
        private driverRepository: Repository<Driver>,
    ) { }

    handleConnection(client: Socket) {
        console.log(`🔌 Cliente conectado: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`🔌 Cliente desconectado: ${client.id}`);
    }

    @SubscribeMessage('driver:location')
    async handleDriverLocation(
        @MessageBody()
        data: { driverId: string; latitude: number; longitude: number },
        @ConnectedSocket() client: Socket,
    ) {
        const { driverId, latitude, longitude } = data;

        try {
            // Buscar driver
            const driver = await this.driverRepository.findOne({
                where: { id: driverId },
            });

            if (!driver) {
                return { error: 'Driver no encontrado' };
            }

            // Guardar ubicación en la base de datos
            const location = this.driverLocationRepository.create({
                driver,
                latitude,
                longitude,
            });

            await this.driverLocationRepository.save(location);

            // Emitir a todos los clientes interesados (opcional)
            this.server.emit(`driver:${driverId}:location`, {
                driverId,
                latitude,
                longitude,
                timestamp: new Date(),
            });

            console.log(`📍 Ubicación actualizada: Driver ${driverId}`);

            return { success: true, timestamp: new Date() };
        } catch (error) {
            console.error('Error guardando ubicación:', error);
            return { error: 'Error guardando ubicación' };
        }
    }

    @SubscribeMessage('driver:connect')
    handleDriverConnect(@MessageBody() data: { driverId: string }) {
        console.log(`🔌 Driver ${data.driverId} conectado al WebSocket`);
        return { success: true, message: 'Conectado al servidor de tracking' };
    }

    @SubscribeMessage('driver:disconnect')
    handleDriverDisconnect(@MessageBody() data: { driverId: string }) {
        console.log(`🔌 Driver ${data.driverId} desconectado del WebSocket`);
        return { success: true, message: 'Desconectado del servidor de tracking' };
    }

    /**
     * Obtener última ubicación de un driver
     */
    @SubscribeMessage('driver:get-location')
    async getDriverLocation(@MessageBody() data: { driverId: string }) {
        const lastLocation = await this.driverLocationRepository.findOne({
            where: { driver: { id: data.driverId } },
            order: { timestamp: 'DESC' },
        });

        if (!lastLocation) {
            return { error: 'No se encontró ubicación para este driver' };
        }

        return {
            driverId: data.driverId,
            latitude: lastLocation.latitude,
            longitude: lastLocation.longitude,
            timestamp: lastLocation.timestamp,
        };
    }
}
