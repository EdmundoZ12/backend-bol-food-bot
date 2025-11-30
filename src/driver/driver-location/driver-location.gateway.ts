import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverLocation } from '../entities/driver-location.entity';
import { Driver } from '../entities/driver.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'driver-location',
})
export class DriverLocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) { }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    client: Socket,
    payload: { driverId: string; latitude: number; longitude: number },
  ) {
    const { driverId, latitude, longitude } = payload;

    if (!driverId || !latitude || !longitude) {
      return;
    }

    // Guardar ubicación en la base de datos
    const location = this.driverLocationRepository.create({
      driver: { id: driverId } as any,
      latitude,
      longitude,
    });

    await this.driverLocationRepository.save(location);

    // Opcional: Emitir a una sala específica si el cliente estuviera escuchando
    // this.server.to(`order_${orderId}`).emit('driverLocation', { latitude, longitude });

    // Log para debug
    // console.log(`Location updated for driver ${driverId}: ${latitude}, ${longitude}`);
  }
}
