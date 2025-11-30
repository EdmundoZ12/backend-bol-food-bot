import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverAssignmentService } from './driver-assignment.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignOrderDto } from './dto/assign-order.dto';

@Controller('driver')
export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly driverAssignmentService: DriverAssignmentService,
  ) { }

  @Post()
  create(@Body() createDriverDto: CreateDriverDto) {
    return this.driverService.create(createDriverDto);
  }

  @Get()
  findAll() {
    return this.driverService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driverService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDriverDto: UpdateDriverDto) {
    return this.driverService.update(id, updateDriverDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.driverService.remove(id);
  }

  // ========== ENDPOINTS DE TRACKING ==========

  /**
   * Actualizar ubicación de un repartidor
   */
  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @Body() locationDto: UpdateLocationDto,
  ) {
    return this.driverService.updateLocation(
      id,
      locationDto.latitude,
      locationDto.longitude,
    );
  }

  /**
   * Obtener repartidores cercanos a una ubicación
   */
  @Get('nearby/search')
  findNearbyDrivers(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number = 5,
  ) {
    return this.driverService.findNearbyDrivers(latitude, longitude, radius);
  }

  /**
   * Obtener historial de ubicaciones de un repartidor
   */
  @Get(':id/location-history')
  getLocationHistory(
    @Param('id') id: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.driverService.getLocationHistory(id, limit);
  }

  /**
   * Actualizar estado de un repartidor
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'AVAILABLE' | 'BUSY' | 'OFFLINE',
  ) {
    return this.driverService.updateStatus(id, status);
  }

  // ========== ENDPOINTS DE ASIGNACIÓN DE PEDIDOS ==========

  /**
   * Asignar pedido al repartidor más cercano
   */
  @Post('orders/:orderId/assign')
  assignOrderToNearestDriver(@Param('orderId') orderId: string) {
    return this.driverAssignmentService.assignOrderToNearestDriver(orderId);
  }

  /**
   * Aceptar un pedido
   */
  @Post('orders/:orderId/accept')
  acceptOrder(
    @Param('orderId') orderId: string,
    @Body() assignDto: AssignOrderDto,
  ) {
    return this.driverAssignmentService.handleDriverAcceptance(
      orderId,
      assignDto.driverId,
    );
  }

  /**
   * Rechazar un pedido
   */
  @Post('orders/:orderId/reject')
  rejectOrder(
    @Param('orderId') orderId: string,
    @Body() assignDto: AssignOrderDto,
  ) {
    return this.driverAssignmentService.handleDriverRejection(
      orderId,
      assignDto.driverId,
    );
  }

  /**
   * Ver historial de asignaciones de un pedido
   */
  @Get('orders/:orderId/assignment-history')
  getOrderAssignmentHistory(@Param('orderId') orderId: string) {
    return this.driverAssignmentService.getOrderAssignmentHistory(orderId);
  }
}

