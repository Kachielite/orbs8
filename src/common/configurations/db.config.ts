import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { constats } from '../constants/env.secrets';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: constats.DB_TYPE,
      host: constats.DB_HOST,
      port: constats.DB_PORT,
      username: constats.DB_USERNAME,
      password: constats.DB_PASSWORD,
      database: constats.DB_NAME,
      entities: [],
      synchronize: true,
    }),
  ],
})
export class DbConfigModule {}