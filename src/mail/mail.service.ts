import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { envConstants } from '../common/constants/env.secrets';
import { InjectRepository } from '@nestjs/typeorm';
import { Token, TokenType } from '../tokens/entities/token.entity';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import * as crypto from 'node:crypto';
import logger from '../common/utils/logger/logger';
import { MailerService } from '@nest-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Token) private readonly tokenRepository: Repository<Token>,
    private readonly mailerService: MailerService,
  ) {}

  async sendResetPasswordEmail(userId: number) {
    logger.info(`Sending reset password email for user with ID: ${userId}`);
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User for reset password not found');
      }

      // Check if a token already exists for this user
      const existingToken = await this.tokenRepository.findOne({
        where: { user: { id: userId }, type: TokenType.RESET_PASSWORD },
      });
      // delete existing token
      if (existingToken) {
        await this.tokenRepository.delete(existingToken.id);
      }
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      logger.info(`Generated token for reset password: ${token}`);
      const newTokenEntry = this.tokenRepository.create({
        user,
        token,
        type: TokenType.RESET_PASSWORD,
        expiresAt,
      });

      logger.info(`Saving token entry for reset password for user with ID: ${userId}`);
      await this.tokenRepository.save(newTokenEntry);

      const { html, subject } = this.resetEmailTemplate({
        token,
        email: user.email,
        name: user.name,
      });

      logger.info('Sending reset password email');
      await this.mailerService.sendMail({
        to: user.email,
        subject,
        html,
      });
      logger.info('Reset password email sent successfully');
    } catch (error) {
      logger.error(`Error sending reset password email: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An error occurred while sending the reset password email',
      );
    }
  }

  private generateToken(length = 32): string {
    // Generate a secure random token using Node.js crypto
    return crypto.randomBytes(length).toString('hex');
  }

  private resetEmailTemplate({
    token,
    email,
    name,
  }: {
    token: string;
    email: string;
    name: string;
  }) {
    const appName = envConstants.APP_NAME;
    const frontendBase = envConstants.FRONTEND_URL;

    // Build reset URL: <base>/reset-password?token=...&email=...
    const resetUrl = new URL('/reset-password', frontendBase);
    resetUrl.searchParams.set('token', token);

    const firstName = (name || '').trim().split(' ')[0] || email.split('@')[0];
    const supportEmail = process.env.SUPPORT_EMAIL;

    const subject = `${appName} password reset`;
    const preheader = `Reset your ${appName} password in a few clicks.`;

    // const text = [
    //   `Hi ${firstName},`,
    //   '',
    //   `We received a request to reset your ${appName} password.`,
    //   `To choose a new password, open the link below:`,
    //   resetUrl.toString(),
    //   '',
    //   `If you did not request this, you can safely ignore this email.`,
    //   `For your security, this link will expire and can be used only once.`,
    //   '',
    //   `Need help? Contact us at ${supportEmail}.`,
    //   '',
    //   `— The ${appName} Team`,
    // ].join('\n');

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${subject}</title>
    <style>
      /* Reset */
      body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table,td{ mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img{ -ms-interpolation-mode:bicubic; }
      body{ margin:0; padding:0; width:100%!important; }
      a{ text-decoration:none; }
      /* Container */
      .wrapper{ width:100%; background:#0b1020; background:linear-gradient(180deg,#0b1020,#0e1328); padding:32px 16px; }
      .container{ max-width:560px; margin:0 auto; background:#0f172a; border:1px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(2,6,23,0.35); }
      .header{ padding:20px 24px; background:rgba(15,23,42,0.9); border-bottom:1px solid rgba(255,255,255,0.06); }
      .brand{ color:#e5e7eb; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:14px; letter-spacing:0.02em; }
      .content{ padding:24px; color:#e5e7eb; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; }
      h1{ margin:0 0 12px; font-size:22px; line-height:1.3; color:#f8fafc; }
      p{ margin:0 0 14px; font-size:14px; line-height:1.7; color:#cbd5e1; }
      .card{ background:linear-gradient(180deg, rgba(30,41,59,0.65), rgba(2,6,23,0.35)); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px; }
      .btn-wrap{ text-align:center; margin:24px 0 10px; }
      .btn{ display:inline-block; padding:12px 20px; border-radius:10px; background:#4f46e5; color:#fff; font-weight:600; font-size:14px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 6px 18px rgba(79,70,229,0.45); }
      .btn:hover{ filter:brightness(1.05); }
      .muted{ color:#94a3b8; font-size:12px; }
      .footer{ padding:18px 24px 24px; border-top:1px solid rgba(255,255,255,0.06); color:#94a3b8; font-size:12px; }
      .link{ color:#93c5fd; }
      @media (prefers-color-scheme: light){
        .wrapper{ background:#f3f4f6; }
        .container{ background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 8px 20px rgba(17,24,39,0.08); }
        .header{ background:#f8fafc; border-bottom:1px solid #e5e7eb; }
        .brand{ color:#111827; }
        .content{ color:#111827; }
        h1{ color:#0f172a; }
        p{ color:#374151; }
        .card{ background:#f9fafb; border:1px solid #e5e7eb; }
        .footer{ color:#6b7280; border-top:1px solid #e5e7eb; }
      }
      /* Mobile */
      @media only screen and (max-width: 600px){
        .content{ padding:20px; }
        h1{ font-size:20px; }
      }
    </style>
  </head>
  <body>
    <span style="display:none!important; visibility:hidden; mso-hide:all; font-size:1px; line-height:1px; color:transparent; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <div class="brand">${appName}</div>
        </div>
        <div class="content">
          <h1>Reset your password</h1>
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your ${appName} password. Click the button below to choose a new password.</p>
          <div class="btn-wrap">
            <a class="btn" style="color: white" href="${resetUrl.toString()}" target="_blank" rel="noopener">Reset password</a>
          </div>
          <p class="muted">For your security, this link will expire and can be used only once. If you didn’t request a reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Need help? <a class="link" href="mailto:${supportEmail}">Contact support</a>.</p>
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

    return {
      subject,
      html,
    };
  }
}

// <div class="card">
//   <p class="muted">If the button doesn’t work, paste this link into your browser:</p>
//   <p style="word-break:break-all; font-size:12px; line-height:1.6;"><a class="link" href="${resetUrl.toString()}" target="_blank" rel="noopener">${resetUrl.toString()}</a></p>
// </div>
