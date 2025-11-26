import { Controller, Get, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':telegramId')
  findOne(@Param('telegramId') telegramId: string) {
    return this.userService.findByTelegramId(telegramId);
  }

  @Get(':telegramId/orders')
  findOneWithOrders(@Param('telegramId') telegramId: string) {
    return this.userService.findOneWithOrders(telegramId);
  }

  @Patch(':telegramId')
  update(
    @Param('telegramId') telegramId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(telegramId, updateUserDto);
  }

  @Patch(':telegramId/deactivate')
  deactivate(@Param('telegramId') telegramId: string) {
    return this.userService.deactivate(telegramId);
  }

  @Patch(':telegramId/activate')
  activate(@Param('telegramId') telegramId: string) {
    return this.userService.activate(telegramId);
  }

  @Delete(':telegramId')
  remove(@Param('telegramId') telegramId: string) {
    return this.userService.remove(telegramId);
  }
}
