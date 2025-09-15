import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { WinstonLogger } from './common/utils/logger/WinstonLogger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new WinstonLogger());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
