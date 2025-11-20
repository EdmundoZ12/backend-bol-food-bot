import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
