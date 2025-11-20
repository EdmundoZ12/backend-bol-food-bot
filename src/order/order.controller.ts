import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Crear orden desde carrito
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createFromCart(createOrderDto);
  }

  // Obtener todas las órdenes
  @Get()
  findAll() {
    return this.orderService.findAll();
  }

  // Obtener estadísticas
  @Get('stats')
  getStats() {
    return this.orderService.getStats();
  }

  // Obtener órdenes por estado
  @Get('status/:status')
  findByStatus(@Param('status') status: string) {
    return this.orderService.findByStatus(status);
  }

  // Obtener órdenes pendientes de asignación
  @Get('pending-assignment')
  findPendingAssignment() {
    return this.orderService.findPendingAssignment();
  }

  // Obtener órdenes de un usuario
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.orderService.findByUser(userId);
  }

  // Obtener órdenes de un conductor
  @Get('driver/:driverId')
  findByDriver(@Param('driverId') driverId: string) {
    return this.orderService.findByDriver(driverId);
  }

  // Obtener una orden
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  // Obtener resumen de orden
  @Get(':id/summary')
  getOrderSummary(@Param('id') id: string) {
    return this.orderService.getOrderSummary(id);
  }

  // Agregar notas
  @Patch(':id/notes')
  addNotes(@Param('id') id: string, @Body('notes') notes: string) {
    return this.orderService.addNotes(id, notes);
  }

  // Establecer método de pago
  @Patch(':id/payment-method')
  setPaymentMethod(
    @Param('id') id: string,
    @Body('method') method: 'CASH' | 'QR',
  ) {
    return this.orderService.setPaymentMethod(id, method);
  }

  // Confirmar pago
  @Patch(':id/confirm-payment')
  confirmPayment(@Param('id') id: string) {
    return this.orderService.confirmPayment(id);
  }

  // Establecer ubicación
  @Patch(':id/location')
  setLocation(
    @Param('id') id: string,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Body('address') address?: string,
  ) {
    return this.orderService.setLocation(id, latitude, longitude, address);
  }

  // Actualizar estado
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.orderService.updateStatus(id, status as any);
  }

  // Asignar conductor
  @Patch(':id/assign-driver')
  assignDriver(@Param('id') id: string, @Body('driverId') driverId: string) {
    return this.orderService.assignDriver(id, driverId);
  }

  // Cancelar orden
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.orderService.cancel(id, reason);
  }

  // Marcar como entregado
  @Patch(':id/delivered')
  markAsDelivered(@Param('id') id: string) {
    return this.orderService.markAsDelivered(id);
  }

  // Actualizar orden
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(id, updateOrderDto);
  }
}
