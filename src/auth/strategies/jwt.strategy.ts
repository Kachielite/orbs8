import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { envConstants } from '../../common/constants/env.secrets';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envConstants.JWT_ACCESS_SECRET as string,
    });
  }

  async validate(payload: { sub: number }) {
    const userId = payload.sub;
    const user = await this.authService.getUserById(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailLinked: user.emailLinked,
      preferredCurrency: user.preferredCurrency,
    };
  }
}
