import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateDriverDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastname: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone: string;

  @IsString()
  @MinLength(2)
  vehicle: string;

  @IsString()
  @IsOptional()
  appToken?: string;
}
