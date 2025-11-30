import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDriverDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  appToken?: string;
}
