import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Buscar usuario por Telegram ID
   */
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { telegramId },
      relations: ['carts', 'orders'],
    });
  }

  /**
   * Crear o actualizar usuario (Upsert)
   * Útil para cuando el usuario inicia el bot
   */
  async upsert(createUserDto: CreateUserDto): Promise<User> {
    // Buscar si el usuario ya existe
    let user = await this.findByTelegramId(createUserDto.telegramId);

    if (user) {
      // Si existe, actualizar datos (por si cambió username, etc.)
      Object.assign(user, createUserDto);
      return this.userRepository.save(user);
    }

    // Si no existe, crear nuevo usuario
    user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Buscar o crear usuario
   * Similar a upsert pero más explícito
   */
  async findOrCreate(
    telegramId: string,
    userData: Partial<CreateUserDto>,
  ): Promise<User> {
    let user = await this.findByTelegramId(telegramId);

    if (!user) {
      user = this.userRepository.create({
        telegramId,
        ...userData,
      });
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Actualizar teléfono del usuario
   */
  async updatePhone(telegramId: string, phone: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    user.phone = phone;
    return this.userRepository.save(user);
  }

  /**
   * Actualizar datos del usuario
   */
  async update(
    telegramId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * Obtener todos los usuarios (admin)
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['orders'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtener un usuario con todos sus pedidos
   */
  async findOneWithOrders(telegramId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { telegramId },
      relations: ['orders', 'orders.orderItems', 'orders.orderItems.product'],
      order: {
        orders: { createdAt: 'DESC' },
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    return user;
  }

  /**
   * Desactivar usuario (soft delete)
   */
  async deactivate(telegramId: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    user.isActive = false;
    return this.userRepository.save(user);
  }

  /**
   * Activar usuario
   */
  async activate(telegramId: string): Promise<User> {
    const user = await this.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    user.isActive = true;
    return this.userRepository.save(user);
  }

  /**
   * Eliminar usuario (hard delete)
   */
  async remove(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }

    await this.userRepository.remove(user);
  }
}
