import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class OrderNotificationDto {
    @IsUUID()
    @IsNotEmpty()
    orderId: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    status: string;
}
