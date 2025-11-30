import { Injectable } from '@nestjs/common';
import { DriverService } from './driver/driver.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly driverService: DriverService,
    private readonly jwtService: JwtService,
  ) {}

  async login() {}

  async resetTokenApp() {}

  async updateTokenApp() {}
}
