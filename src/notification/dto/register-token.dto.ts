import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class RegisterTokenDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsOptional()
    @IsIn(['android', 'ios', 'web'])
    deviceType?: string;
}
