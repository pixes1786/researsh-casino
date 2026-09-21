import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, MfaCodeDto } from './dto';
import { MfaService } from './mfa.service';
import { CaptchaService } from '../captcha/captcha.service';
import { JwtGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_COOKIE = 'device_token';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private mfa: MfaService,
    private captcha: CaptchaService,
  ) {}

  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const okCaptcha = await this.captcha.verify(dto.turnstileToken, clientIp(req));
    if (!okCaptcha) throw new UnauthorizedException('CAPTCHA_FAILED');
    const t = await this.auth.register(dto, clientIp(req), req.headers['user-agent']);
    this.setAuthCookies(res, t.accessToken, t.refreshToken);
    this.setDeviceCookie(res, t.deviceToken);
    return { ok: true };
  }

  @Post('login')
  @Throttle({ auth: { limit: 8, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // captcha мягкая: проверяется только если задан токен (в проде фронт всегда шлёт)
    if (dto.turnstileToken) {
      const okCaptcha = await this.captcha.verify(dto.turnstileToken, clientIp(req));
      if (!okCaptcha) throw new UnauthorizedException('CAPTCHA_FAILED');
    }
    const t = await this.auth.login(dto, clientIp(req), req.headers['user-agent']);
    if ('mfaRequired' in t) return t;
    this.setAuthCookies(res, t.accessToken, t.refreshToken);
    this.setDeviceCookie(res, (t as any).deviceToken);
    return {
      ok: true,
      mfaVerified: (t as any).mfaVerified,
      setupRequired: (t as any).setupRequired ?? false,
    };
  }

  @Post('device-login')
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  async deviceLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[DEVICE_COOKIE];
    const t = await this.auth.autoLogin(raw, clientIp(req), req.headers['user-agent']);
    if (!t) {
      res.clearCookie(DEVICE_COOKIE);
      return { ok: false };
    }
    this.setAuthCookies(res, t.accessToken, t.refreshToken);
    this.setDeviceCookie(res, t.deviceToken);
    return { ok: true };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[DEVICE_COOKIE];
    await this.auth.logoutByDeviceToken(raw);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie(DEVICE_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() u: any) {
    return this.auth.me(u.sub);
  }

  @Get('devices')
  @UseGuards(JwtGuard)
  devices(@CurrentUser() u: any) {
    return this.auth.listDevices(u.sub);
  }

  @Delete('devices/:id')
  @UseGuards(JwtGuard)
  revokeDevice(@CurrentUser() u: any, @Param('id') id: string) {
    return this.auth.revokeDevice(u.sub, id);
  }

  @Post('devices/revoke-all')
  @UseGuards(JwtGuard)
  revokeAll(@CurrentUser() u: any, @Res({ passthrough: true }) res: Response) {
    res.clearCookie(DEVICE_COOKIE);
    return this.auth.revokeAllDevices(u.sub);
  }

  @Get('2fa/status')
  @UseGuards(JwtGuard)
  status(@CurrentUser() u: any) {
    return this.mfa.status(u.sub);
  }

  @Post('2fa/setup')
  @UseGuards(JwtGuard)
  setup(@CurrentUser() u: any) {
    return this.mfa.setup(u.sub);
  }

  @Post('2fa/enable')
  @UseGuards(JwtGuard)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  enable(@CurrentUser() u: any, @Body() dto: MfaCodeDto) {
    return this.mfa.enable(u.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtGuard)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  disable(@CurrentUser() u: any, @Body() dto: MfaCodeDto) {
    return this.mfa.disable(u.sub, dto.code);
  }

  // ─── helpers ───
  private setAuthCookies(res: Response, access: string, refresh: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: THIRTY_DAYS,
      path: '/',
    });
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: THIRTY_DAYS,
      path: '/',
    });
  }

  private setDeviceCookie(res: Response, token: string | undefined) {
    if (!token) return;
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(DEVICE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: THIRTY_DAYS,
      path: '/',
    });
  }
}

function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0';
}
