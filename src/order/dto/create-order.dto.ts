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
}
