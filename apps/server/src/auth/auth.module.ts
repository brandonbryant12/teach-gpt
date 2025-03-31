import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './local.strategy';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JWT_EXPIRATION_TIME, JWT_SECRET } from '../db/drizzle.constants';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule,
    DrizzleModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>(JWT_SECRET);
        const expiresIn = configService.get<string>(JWT_EXPIRATION_TIME);
        console.log(`[AuthModule] JWT expiresIn configured as: ${expiresIn}`);
        return {
          secret: secret,
          signOptions: {
            expiresIn: expiresIn,
          },
        };
      },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
