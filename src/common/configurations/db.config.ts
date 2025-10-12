import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Email } from '../../email/entities/email.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Token } from '../../tokens/entities/token.entity';
import { Account } from '../../account/entities/account.entity';
import { Bank } from '../../bank/entities/bank.entity';
import { Category } from '../../category/entities/category.entity';
import { Currency } from '../../currency/entities/currency.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { CategoryFeedback } from '../../category/entities/category-feedback.entity';
import { Notification } from '../../notification/entities/notification.entity';

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
        entities: [
          User,
          Email,
          Subscription,
          Token,
          Account,
          Bank,
          Category,
          Currency,
          Transaction,
          CategoryFeedback,
          Notification,
        ],
        autoLoadEntities: true,
        synchronize: true, // Disabled to prevent overriding manual vector schema changes
      }),
    }),
  ],
})
export class DbConfigModule {}
