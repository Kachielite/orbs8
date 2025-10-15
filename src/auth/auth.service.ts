import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { GeneralResponseDto } from '../common/dto/general-response.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { envConstants } from '../common/constants/env.secrets';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import logger from '../common/utils/logger/logger';
import { GoogleLoginDto } from './dto/google-login.dto';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail/mail.service';
import { Token } from '../tokens/entities/token.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyPasswordTokenDto } from './dto/verify-password-token.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Token) private readonly tokenRepository: Repository<Token>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(request: RegisterDto): Promise<GeneralResponseDto> {
    logger.info(`Registering user with email: ${request.email}`);
    try {
      const user = await this.checkUserExists(request.email);

      if (user) {
        logger.error(`User with email ${request.email} already exists`);
        throw new ConflictException(`User with email ${request.email} already exists`);
      }

      const hashedPassword = await this.hashPassword(request.password);

      const newUser = this.userRepository.create({
        ...request,
        password: hashedPassword,
        preferredCurrency: request.currencyCode,
      });

      await this.userRepository.save(newUser);
      logger.info(`User with email ${request.email} registered successfully`);
      return new GeneralResponseDto('Registration successful, please login');
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      logger.error(`Error registering user with email ${request.email}: ${error.message}`);
      throw new InternalServerErrorException('An error occurred during registration');
    }
  }

  async login(request: LoginDto): Promise<AuthResponseDto> {
    try {
      logger.info(`Logging in user with email: ${request.email}`);
      const user = await this.checkUserExists(request.email);

      if (!user) {
        logger.error(`User with email ${request.email} not found`);
        throw new NotFoundException(`User with email ${request.email} not found`);
      }

      // Ensure the user has a password set (non-Google accounts)
      if (!user.password) {
        logger.error(
          `User with email ${request.email} does not have a password set (likely Google account)`,
        );
        throw new UnauthorizedException(
          'This account does not have a password. Please log in with Google or use password reset to set one.',
        );
      }

      const isPasswordValid = await this.comparePasswords(request.password, user.password);

      if (!isPasswordValid) {
        logger.error(`Invalid password for user with email ${request.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const accessToken = this.generateToken(user, 'access');
      const refreshToken = this.generateToken(user, 'refresh');

      logger.info(`User with email ${request.email} logged in successfully`);
      return new AuthResponseDto('Login successful', accessToken, refreshToken);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      logger.error(`Error logging in user with email ${request.email}: ${error.message}`);
      throw new InternalServerErrorException('An error occurred during login');
    }
  }

  async loginWithGoogle(request: GoogleLoginDto): Promise<AuthResponseDto> {
    logger.info('Attempting Google login');
    try {
      const payload = await this.verifyGoogleIdToken(request.idToken);

      const email = payload.email;
      const googleId = payload.sub;
      const name = (payload.name as string) || email.split('@')[0];
      const picture = (payload.picture as string) || null;

      if (!payload.email_verified) {
        logger.error(`Google email not verified for sub: ${googleId}`);
        throw new UnauthorizedException('Google account email not verified');
      }

      // Prefer matching by googleId first
      let user = await this.userRepository.findOne({ where: { googleId } });

      if (!user) {
        // Fallback to email match, and link if exists
        user = await this.userRepository.findOne({ where: { email } });
        if (user) {
          logger.info(`Linking existing account ${email} with Google ID ${googleId}`);
          user.googleId = googleId;
          user.provider = 'google';
          user.picture = user.picture || picture;
          await this.userRepository.save(user);
        } else {
          logger.info(`Creating new Google user for ${email}`);
          user = this.userRepository.create({
            email,
            name,
            provider: 'google',
            googleId,
            picture,
            password: null,
          });
          await this.userRepository.save(user);
        }
      }

      const accessToken = this.generateToken(user, 'access');
      const refreshToken = this.generateToken(user, 'refresh');
      logger.info(`Google login successful for ${email}`);
      return new AuthResponseDto('Login successful', accessToken, refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      logger.error(`Error during Google login: ${error?.message || error}`);
      throw new InternalServerErrorException('An error occurred during Google login');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      logger.info(`Refreshing token for user with refresh token: ${refreshToken.substring(0, 20)}`);
      const payload: { sub: number } = this.jwtService.verify(refreshToken, {
        secret: envConstants.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        logger.error(`User with ID ${payload.sub} not found`);
        throw new UnauthorizedException('Invalid refresh token');
      }
      const accessToken = this.generateToken(user, 'access');
      const newRefreshToken = this.generateToken(user, 'refresh');

      logger.info(`Token refreshed for user with ID ${payload.sub}`);
      return new AuthResponseDto('Token refreshed successfully', accessToken, newRefreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      logger.error(
        `Error refreshing token for user with refresh token ${refreshToken}: ${error.message}`,
      );
      throw new InternalServerErrorException('An error occurred during token refresh');
    }
  }

  async verifyPasswordResetToken(request: VerifyPasswordTokenDto): Promise<GeneralResponseDto> {
    try {
      const { token, email } = request;
      logger.info(`Verifying password reset token: ${token.substring(0, 20)} for email: ${email}`);
      const checkToken = await this.tokenRepository.findOne({
        where: { token },
        relations: ['user'],
      });

      if (!checkToken) {
        throw new ForbiddenException('Invalid reset token');
      }

      const now = new Date();
      if (checkToken.expiresAt < now) {
        throw new ForbiddenException('Reset token has expired');
      }

      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        throw new ForbiddenException('User not found');
      }

      if (checkToken.user.id !== user.id) {
        throw new ForbiddenException('Invalid reset token');
      }

      return new GeneralResponseDto('Password reset token is valid');
    } catch (error) {
      console.log('error', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      logger.error(`Error verifying password reset token: ${error.message}`);
      throw new InternalServerErrorException('An error occurred during password reset');
    }
  }

  async requestPasswordReset(email: string): Promise<GeneralResponseDto> {
    logger.info(`Requesting password reset for email: ${email}`);
    try {
      const user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        throw new NotFoundException(`User with email ${email} not found`);
      }

      await this.mailService.sendResetPasswordEmail(user.id);

      return new GeneralResponseDto('Password reset request sent successfully');
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error requesting password reset for email ${email}: ${error.message}`);
      throw new InternalServerErrorException('An error occurred during password reset');
    }
  }

  async resetPassword(request: ResetPasswordDto): Promise<GeneralResponseDto> {
    logger.info('Resetting password');
    try {
      const { token, newPassword } = request;
      const checkToken = await this.tokenRepository.findOne({
        where: { token },
        relations: ['user'],
      });

      if (!checkToken) {
        throw new NotFoundException('Invalid reset token');
      }

      // Check if the token has expired
      const now = new Date();
      if (checkToken.expiresAt < now) {
        throw new UnauthorizedException('Reset token has expired');
      }

      // Update password
      const hashedPassword = await this.hashPassword(newPassword);
      await this.userRepository.update(checkToken.user.id, { password: hashedPassword });

      // Delete the used token
      await this.tokenRepository.delete(checkToken.id);

      return new GeneralResponseDto('Password reset successful');
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      logger.error(`Error resetting password: ${error.message}`);
      throw new InternalServerErrorException('An error occurred during password reset');
    }
  }

  async getUserById(id: number): Promise<User> {
    try {
      logger.info(`Fetching user with ID: ${id}`);
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        logger.error(`User with ID ${id} not found`);
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error(`Error fetching user with ID ${id}: ${error.message}`);
      throw new InternalServerErrorException('An error occurred while fetching user');
    }
  }

  private async checkUserExists(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  private generateToken(user: User, type: 'access' | 'refresh'): string {
    const payload = {
      sub: user.id,
    };

    if (type === 'access') {
      return this.jwtService.sign(payload, {
        secret: envConstants.JWT_ACCESS_SECRET,
        expiresIn: '1d',
      });
    }

    return this.jwtService.sign(payload, {
      secret: envConstants.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });
  }

  private async verifyGoogleIdToken(idToken: string) {
    try {
      const client = new OAuth2Client(envConstants.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: envConstants.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }
      return payload as {
        sub: string;
        email: string;
        email_verified: boolean;
        name?: string;
        picture?: string;
      };
    } catch (e) {
      logger.error(`Failed to verify Google ID token: ${e?.message || e}`);
      throw new UnauthorizedException('Invalid Google token');
    }
  }
}
