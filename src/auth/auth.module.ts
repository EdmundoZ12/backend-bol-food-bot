import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DriverModule } from '../driver/driver.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants/jwt.constant';

@Module({
  imports: [
    DriverModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
