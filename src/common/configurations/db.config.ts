import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Email } from '../../email/entities/email.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [User, Email, Subscription],
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
})
export class DbConfigModule {}
