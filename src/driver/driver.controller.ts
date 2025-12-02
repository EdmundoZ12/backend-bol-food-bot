import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { DriverStatus } from './entities/driver.entity';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  // Registro de nuevo driver (público)
  @Post('register')
  create(@Body() createDriverDto: CreateDriverDto) {
    return this.driverService.create(createDriverDto);
  }

  // Obtener todos los drivers (protegido)
  @UseGuards(AuthGuard)
  @Get()
  findAll() {
    return this.driverService.findAll();
  }

  // Obtener un driver por ID (protegido)
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.findOne(id);
  }

  // Actualizar driver (protegido)
  @UseGuards(AuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ) {
    return this.driverService.update(id, updateDriverDto);
  }

  // Cambiar estado del driver (protegido)
  @UseGuards(AuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DriverStatus,
  ) {
    return this.driverService.updateStatus(id, status);
  }

  // Actualizar ubicación del driver (protegido)
  @UseGuards(AuthGuard)
  @Post(':id/location')
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.driverService.updateLocation(
      id,
      updateLocationDto.latitude,
      updateLocationDto.longitude,
      updateLocationDto.accuracy,
      updateLocationDto.speed,
      updateLocationDto.heading,
    );
  }

  // Obtener última ubicación del driver (protegido)
  @UseGuards(AuthGuard)
  @Get(':id/location')
  getLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.getLastLocation(id);
  }

  // Ponerse disponible (protegido)
  @UseGuards(AuthGuard)
  @Patch(':id/available')
  setAvailable(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.updateStatus(id, DriverStatus.AVAILABLE);
  }

  // Ponerse ocupado (protegido)
  @UseGuards(AuthGuard)
  @Patch(':id/busy')
  setBusy(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.updateStatus(id, DriverStatus.BUSY);
  }

  // Ponerse offline (protegido)
  @UseGuards(AuthGuard)
  @Patch(':id/offline')
  setOffline(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.updateStatus(id, DriverStatus.OFFLINE);
  }

  // Eliminar driver (protegido)
  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.driverService.remove(id);
  }
}
