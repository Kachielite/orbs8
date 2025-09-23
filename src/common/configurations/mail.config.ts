import { Module } from '@nestjs/common';
import { MailerModule } from '@nest-modules/mailer';
import { envConstants } from '../constants/env.secrets';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: envConstants.SMTP_HOST,
        port: envConstants.SMTP_PORT,
        secure: process.env.SMTP_TLS === 'yes', // true for 465, false for other ports
        auth: {
          user: envConstants.SMTP_USERNAME,
          pass: envConstants.SMTP_PASSWORD,
        },
      },
    }),
  ],
})
export class MailConfigModule {}
