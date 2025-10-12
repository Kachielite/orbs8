import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import logger from '../common/utils/logger/logger';
import { envConstants } from '../common/constants/env.secrets';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notification/entities/notification.entity';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/sync' })
export class EmailGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Namespace;
  private readonly JWT_SECRET = envConstants.JWT_ACCESS_SECRET as string;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = jwt.verify(token, this.JWT_SECRET) as { sub: string | number };
      const userId: string = String(payload.sub);

      socket.data.userId = userId;
      await socket.join(userId); // ✅ Join user's personal room

      // Extra visibility: confirm the room membership after join
      const roomSize = this.server.adapter?.rooms?.get(userId)?.size ?? 0;
      logger.info(`User ${userId} connected via WebSocket (room size now: ${roomSize})`);
      void socket.emit('connected', { message: 'Connected to OrbS8 sync server' });
    } catch (error) {
      logger.error('Socket auth error:', (error as Error).message);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    logger.info(`User ${socket.data.userId} disconnected`);
  }

  // Public utility: emit to a specific user's room in this namespace
  sendToUser(userId: string, event: string, data: any) {
    const roomSize = this.server.adapter?.rooms?.get(userId)?.size ?? 0;
    logger.info(
      `Emitting event '${event}' to user ${userId} (room size: ${roomSize}) with data: ${JSON.stringify(
        data,
      )}`,
    );
    this.server.to(String(userId)).emit(event, data);
  }

  @SubscribeMessage('notification')
  async handleInit(socket: Socket) {
    const userId = socket.data.userId as string;
    const notifications = await this.notificationRepository.find({
      where: { userId: parseInt(userId, 10) },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    // send latest notifications to user
    this.sendToUser(userId, 'notification', {
      data: notifications,
      count: notifications.length,
    });
  }

  // Optional: for manual testing
  @SubscribeMessage('ping')
  handlePing(socket: Socket) {
    logger.info(`Received ping from user ${socket.data.userId}, emitting pong`);
    socket.emit('ping', { time: new Date() });
  }

  @SubscribeMessage('test-sync')
  handleTestSync(socket: Socket) {
    const userId = socket.data.userId as string;
    logger.info(`Test sync triggered for user ${userId}`);
    this.sendToUser(userId, 'sync_started', { message: 'Test sync started' });
  }
}
