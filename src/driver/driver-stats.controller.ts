import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DriverStatsService } from '../common/services/driver-stats.service';
import { AuthGuard } from '../auth/guard/auth.guard';

@Controller('driver/stats')
@UseGuards(AuthGuard)
export class DriverStatsController {
  constructor(private readonly driverStatsService: DriverStatsService) {}

  /**
   * Obtener estadísticas del driver autenticado
   * GET /api/driver/stats
   */
  @Get()
  async getMyStats(@Request() req: any) {
    // AuthGuard pone el driver en req.user
    const driverId = req.user.id;
    return this.driverStatsService.getDriverStats(driverId);
  }
}
