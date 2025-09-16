import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { constats } from '../common/constants/env.secrets';
import { OAuth2Client } from 'google-auth-library';
import logger from '../common/utils/logger/logger';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Email, EmailProvider } from './entities/email.entity';
import { DeepPartial, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { StatusDto } from './dto/status.dto';

@Injectable()
export class EmailService {
  private oauth2Client: OAuth2Client;
  private SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly', // read-only
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      constats.GOOGLE_CLIENT_ID,
      constats.GOOGLE_CLIENT_SECRET,
      constats.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    try {
      logger.info('Getting google auth url');
      return this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES,
        prompt: 'consent',
      });
    } catch (error) {
      logger.error(`Failed to get auth url: ${error.message}`);
      throw new InternalServerErrorException(`Failed to get auth url: ${error.message}`);
    }
  }

  async getToken(code: string, user: User): Promise<GeneralResponseDto> {
    try {
      logger.info('Obtaining Gmail access');
      const accessData = await this.oauth2Client.getToken(code);

      if (
        !accessData.tokens.refresh_token &&
        !accessData.tokens.access_token &&
        !accessData.tokens.expiry_date
      ) {
        throw new BadRequestException('Failed to obtain access token');
      }

      // Check expiry_date is defined
      if (!accessData.tokens.expiry_date) {
        throw new BadRequestException('Token expiry date is missing');
      }

      // Save token details
      logger.info('Gmail access obtained, saving token details');
      const newEmailAccess = this.emailRepository.create({
        user: user,
        provider: EmailProvider.GMAIL,
        accessToken: accessData.tokens.access_token!,
        refreshToken: accessData.tokens.refresh_token ?? null,
        expiresAt: new Date(accessData.tokens.expiry_date),
      } as DeepPartial<Email>);

      await this.emailRepository.save(newEmailAccess);
      return new GeneralResponseDto('Gmail access obtained successfully');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      logger.error(`Failed to obtain Gmail access: ${error.message}`);
      throw new InternalServerErrorException(`Failed to obtain Gmail access: ${error.message}`);
    }
  }

  async getSyncStatus(user: User): Promise<StatusDto> {
    try {
      logger.info(`Getting sync status for user: ${user.id}`);

      const source = await this.emailRepository.findOne({
        where: {
          user: user,
        },
        relations: ['user'],
      });

      if (!source) {
        logger.error(`Sync status not found for user: ${user.id}`);
        return new StatusDto(false);
      }

      const connection = !!source.accessToken && !!source.refreshToken;

      return new StatusDto(connection, source.emailsReceived, source.lastSyncAt);
    } catch (error) {
      logger.error(`Failed to get sync status: ${error.message}`);
      throw new InternalServerErrorException(`Failed to get sync status: ${error.message}`);
    }
  }
}
