import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDriverDto } from './dto/login-driver.dto';
import { AuthGuard } from './guard/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDriverDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
