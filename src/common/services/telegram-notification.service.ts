import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../order/entities/order.entity';
import { User } from '../../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Enviar mensaje a un usuario de Telegram
   */
  async sendMessage(chatId: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        this.logger.error(
          `Error enviando mensaje a ${chatId}: ${data.description}`,
        );
        return false;
      }

      this.logger.log(`✅ Mensaje enviado a ${chatId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error enviando mensaje: ${error.message}`);
      return false;
    }
  }

  /**
   * Notificar al cliente cuando el driver acepta el pedido
   */
  async notifyOrderAccepted(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) {
      this.logger.warn('No se puede notificar: usuario sin telegramId');
      return;
    }

    const driverName = order.driver ? `${order.driver.name}` : 'Un conductor';
    const vehicle = order.driver?.vehicle || 'Vehículo';

    const message = `
🎉 <b>¡Tu pedido fue aceptado!</b>

👨‍💼 <b>Conductor:</b> ${driverName}
🚗 <b>Vehículo:</b> ${vehicle}

📦 El conductor se dirige al restaurante a recoger tu pedido.

Te avisaremos cuando esté en camino. 🛵
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar al cliente cuando el driver recoge el pedido
   */
  async notifyOrderPickedUp(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) return;

    const message = `
📦 <b>¡Tu pedido fue recogido!</b>

El conductor ya tiene tu pedido y está saliendo del restaurante.

🚀 ¡En breve estará contigo!
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar al cliente cuando el pedido está en camino
   */
  async notifyOrderInTransit(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) return;

    const address = order.deliveryAddress || 'tu ubicación';

    const message = `
🛵 <b>¡Tu pedido está en camino!</b>

El conductor se dirige a: <i>${address}</i>

⏱ Tiempo estimado: 10-15 minutos

¡Prepárate para recibir tu pedido! 🍔
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar al cliente cuando el conductor está en la puerta
   */
  async notifyOrderAtDoor(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) return;

    const driverName = order.driver ? `${order.driver.name}` : 'El conductor';

    const message = `
🚪 <b>¡El conductor está en tu puerta!</b>

👨‍💼 <b>${driverName}</b> ha llegado a tu ubicación.

📍 Por favor, sal a recibir tu pedido.

⏱ El conductor te está esperando.
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar al cliente cuando el pedido fue entregado
   */
  async notifyOrderDelivered(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) return;

    const total = order.totalAmount?.toFixed(2) || '0.00';

    const message = `
✅ <b>¡Pedido entregado!</b>

🎉 Tu pedido ha sido entregado exitosamente.

💰 <b>Total:</b> ${total} Bs.

¡Gracias por tu preferencia! 🙏
Esperamos que disfrutes tu comida. 😋

⭐ ¿Te gustó el servicio? ¡Cuéntanos tu experiencia!
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar al cliente cuando no hay conductores disponibles
   */
  async notifyNoDriversAvailable(order: Order): Promise<void> {
    const telegramId = order.user?.telegramId;
    if (!telegramId) return;

    const message = `
😔 <b>Lo sentimos</b>

No hay conductores disponibles en este momento para tu pedido.

Por favor, intenta de nuevo en unos minutos.

🙏 Disculpa las molestias.
    `.trim();

    await this.sendMessage(telegramId, message);
  }

  /**
   * Notificar según el estado del pedido
   */
  async notifyOrderStatusChange(
    order: Order,
    status: OrderStatus,
  ): Promise<void> {
    switch (status) {
      case OrderStatus.ACCEPTED:
        await this.notifyOrderAccepted(order);
        break;
      case OrderStatus.PICKED_UP:
        await this.notifyOrderPickedUp(order);
        break;
      case OrderStatus.IN_TRANSIT:
        await this.notifyOrderInTransit(order);
        break;
      case OrderStatus.AT_DOOR:
        await this.notifyOrderAtDoor(order);
        break;
      case OrderStatus.DELIVERED:
        await this.notifyOrderDelivered(order);
        break;
      case OrderStatus.REJECTED:
        await this.notifyNoDriversAvailable(order);
        break;
    }
  }
}
