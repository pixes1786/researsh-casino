import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev_secret_change_me_please_1234567890',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, MfaService],
  controllers: [AuthController],
  exports: [JwtModule, MfaService],
})
export class AuthModule {}
