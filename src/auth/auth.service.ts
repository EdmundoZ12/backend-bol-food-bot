import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DriverService } from '../driver/driver.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDriverDto } from './dto/login-driver.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export interface LoginResponse {
  access_token: string;
  driver: {
    id: string;
    email: string;
    name: string;
    lastname: string;
    status: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly driverService: DriverService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDriverDto): Promise<LoginResponse> {
    const { email, password, appToken } = loginDto;

    const driver = await this.driverService.findByEmailWithPassword(email);

    if (!driver) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!driver.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await this.driverService.validatePassword(
      password,
      driver.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Actualizar appToken si se proporciona
    if (appToken) {
      await this.driverService.updateAppToken(driver.id, appToken);
    }

    const payload: JwtPayload = {
      sub: driver.id,
      email: driver.email,
      name: driver.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      driver: {
        id: driver.id,
        email: driver.email,
        name: driver.name,
        lastname: driver.lastname,
        status: driver.status,
      },
    };
  }

  async logout(driverId: string): Promise<{ message: string }> {
    await this.driverService.updateAppToken(driverId, null);
    return { message: 'Logged out successfully' };
  }

  async getProfile(driverId: string) {
    const driver = await this.driverService.findOne(driverId);
    const { password, ...result } = driver;
    return result;
  }
}
