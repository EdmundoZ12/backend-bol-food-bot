import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class UpdateOrderDto {
  @IsEnum([
    'PENDING',
    'CONFIRMED',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED',
  ])
  @IsOptional()
  status?: string;

  @IsEnum(['CASH', 'QR'])
  @IsOptional()
  paymentMethod?: string;

  @IsEnum(['PENDING', 'COMPLETED', 'FAILED'])
  @IsOptional()
  paymentStatus?: string;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  driverId?: string;
}
