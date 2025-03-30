import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_SECRET } from '../db/drizzle.constants';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    const secret = configService.get<string>(JWT_SECRET);
    if (!secret) {
      throw new Error('JWT_SECRET environment variable not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Passport first verifies the JWT's signature and expiration using the secret,
  // then calls this validate method with the decoded payload.
  validate(payload: { sub: number; email: string }) {
    // We trust the payload here because Passport already verified the signature.
    // We can use the user ID (sub) from the payload to fetch the user,
    // potentially adding more checks (e.g., is the user active?).

    // For now, we just return the essential payload info.
    // You might want to fetch the full user object from the database using userService
    // if you need more user details in your protected routes.
    // const user = await this.userService.findOneById(payload.sub);
    // if (!user) { throw new UnauthorizedException(); }
    // return user;

    return { userId: payload.sub, email: payload.email };
  }
}
