import {
  Controller,
  Post,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderAssignmentService } from '../common/services/order-assignment.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { OrderStatus } from '../order/entities/order.entity';

@Controller('driver/orders')
@UseGuards(AuthGuard)
export class DriverOrderController {
  constructor(
    private readonly orderAssignmentService: OrderAssignmentService,
  ) {}

  /**
   * Aceptar un pedido asignado
   * POST /api/driver/orders/:orderId/accept
   */
  @Post(':orderId/accept')
  async acceptOrder(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido: era req.driver.id
    return this.orderAssignmentService.acceptOrder(orderId, driverId);
  }

  /**
   * Rechazar un pedido asignado
   * POST /api/driver/orders/:orderId/reject
   */
  @Post(':orderId/reject')
  async rejectOrder(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido
    return this.orderAssignmentService.rejectOrder(orderId, driverId);
  }

  /**
   * Actualizar estado: Voy al restaurante
   * PATCH /api/driver/orders/:orderId/picking-up
   */
  @Patch(':orderId/picking-up')
  async markPickingUp(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido
    return this.orderAssignmentService.updateOrderProgress(
      orderId,
      driverId,
      OrderStatus.PICKING_UP,
    );
  }

  /**
   * Actualizar estado: Recogí el pedido
   * PATCH /api/driver/orders/:orderId/picked-up
   */
  @Patch(':orderId/picked-up')
  async markPickedUp(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido
    return this.orderAssignmentService.updateOrderProgress(
      orderId,
      driverId,
      OrderStatus.PICKED_UP,
    );
  }

  /**
   * Actualizar estado: En camino al cliente
   * PATCH /api/driver/orders/:orderId/in-transit
   */
  @Patch(':orderId/in-transit')
  async markInTransit(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido
    return this.orderAssignmentService.updateOrderProgress(
      orderId,
      driverId,
      OrderStatus.IN_TRANSIT,
    );
  }

  /**
   * Actualizar estado: Entregado
   * PATCH /api/driver/orders/:orderId/delivered
   */
  @Patch(':orderId/delivered')
  async markDelivered(@Param('orderId') orderId: string, @Request() req: any) {
    const driverId = req.user.sub; // <-- Corregido
    return this.orderAssignmentService.updateOrderProgress(
      orderId,
      driverId,
      OrderStatus.DELIVERED,
    );
  }
}
