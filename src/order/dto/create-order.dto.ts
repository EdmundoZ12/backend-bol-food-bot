import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  userId: string; // telegramId

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(['CASH', 'QR'])
  @IsOptional()
  paymentMethod?: 'CASH' | 'QR';

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;
}
