import {
  ConflictException,
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
import { constats } from '../common/constants/env.secrets';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(request: RegisterDto): Promise<GeneralResponseDto> {
    try {
      const user = await this.checkUserExists(request.email);

      if (user) {
        throw new ConflictException(`User with email ${request.email} already exists`);
      }

      const hashedPassword = await this.hashPassword(request.password);

      const newUser = this.userRepository.create({
        ...request,
        password: hashedPassword,
      });

      await this.userRepository.save(newUser);
      return new GeneralResponseDto('Registration successful, please login');
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('An error occurred during registration');
    }
  }

  async login(request: LoginDto): Promise<AuthResponseDto> {
    try {
      const user = await this.checkUserExists(request.email);

      if (!user) {
        throw new NotFoundException(`User with email ${request.email} not found`);
      }

      const isPasswordValid = await this.comparePasswords(request.password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const accessToken = this.generateToken(user, 'access');
      const refreshToken = this.generateToken(user, 'refresh');

      return new AuthResponseDto('Login successful', accessToken, refreshToken);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('An error occurred during login');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload: { sub: number } = this.jwtService.verify(refreshToken, {
        secret: constats.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const accessToken = this.generateToken(user, 'access');
      const newRefreshToken = this.generateToken(user, 'refresh');
      return new AuthResponseDto('Token refreshed successfully', accessToken, newRefreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('An error occurred during token refresh');
    }
  }

  async getUserById(id: number): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
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
        secret: constats.JWT_ACCESS_SECRET,
        expiresIn: '1d',
      });
    }

    return this.jwtService.sign(payload, {
      secret: constats.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });
  }
}
