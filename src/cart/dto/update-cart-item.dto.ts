import { IsInt, Min, IsOptional, IsString } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
