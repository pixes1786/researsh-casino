import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
import { MfaService } from './mfa.service';
import { SecurityService } from '../security/security.service';

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const DEVICE_TOKEN_DAYS = 30;

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function newDeviceToken(): string {
  return randomBytes(32).toString('hex');
}
function ipPrefix(ip: string | null | undefined): string {
  return (ip ?? '').split('.').slice(0, 3).join('.');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mfa: MfaService,
    private security: SecurityService,
  ) {}

  // ─────────────────────── public ───────────────────────

  async register(dto: RegisterDto, ip?: string, ua?: string) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (exists) throw new BadRequestException('USER_EXISTS');

    const passwordHash = await argon2.hash(dto.password, ARGON_OPTS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        profile: { create: {} },
        wallet: { create: { currency: 'RC', balance: 0 } },
      },
      include: { wallet: true },
    });

    const bonus = 1000;
    await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { userId: user.id }, data: { balance: bonus } }),
      this.prisma.ledgerEntry.create({
        data: {
          walletId: user.wallet!.id,
          userId: user.id,
          type: 'SIGNUP_BONUS',
          amount: bonus,
          balanceAfter: bonus,
          reason: 'Welcome bonus (virtual)',
        },
      }),
    ]);

    await this.security.track('user_registered', {
      userId: user.id,
      ip,
      userAgent: ua,
      severity: 'info',
      meta: { email: user.email },
    });

    const access = this.issueTokens(user.id, user.email, user.role, false);
    const deviceToken = await this.issueDeviceToken(user.id, ip, ua);
    return { ...access, deviceToken };
  }

  async login(dto: LoginDto, ip?: string, ua?: string) {
    const id = (dto.identifier ?? '').trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: id.toLowerCase() }, { username: id }],
      },
    });
    if (!user) {
      await this.security.track('login_failed', {
        ip,
        userAgent: ua,
        severity: 'warn',
        meta: { identifier: id, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('BAD_CREDS');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.security.track('login_failed', {
        userId: user.id,
        ip,
        userAgent: ua,
        severity: 'warn',
        meta: { identifier: id, reason: 'bad_password' },
      });
      throw new UnauthorizedException('BAD_CREDS');
    }
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('ACCOUNT_BLOCKED');

    // ─── MFA branch (only if user has it enabled) ───
    if (user.mfaEnabled) {
      if (!dto.code) return { mfaRequired: true as const };
      const valid = await this.mfa.verifyLogin(user.id, dto.code);
      if (!valid) {
        await this.security.track('mfa_failed', {
          userId: user.id,
          ip,
          userAgent: ua,
          severity: 'danger',
        });
        throw new UnauthorizedException('BAD_TOTP');
      }
      await this.security.track('login_success', {
        userId: user.id,
        ip,
        userAgent: ua,
        severity: 'info',
        meta: { mfa: true },
      });
      const access = this.issueTokens(user.id, user.email, user.role, true);
      const deviceToken = await this.issueDeviceToken(user.id, ip, ua);
      return { ...access, deviceToken, setupRequired: false as const };
    }

    // ─── Non-MFA user. Admins can log in directly (MFA-for-admin enforcement is temporarily disabled). ───
    const adminRoles = ['ADMIN', 'SUPERADMIN', 'RISK'];
    if (adminRoles.includes(user.role)) {
      await this.security.track('login_success', {
        userId: user.id,
        ip,
        userAgent: ua,
        severity: 'warn',
        meta: { mfa: false, role: user.role, note: 'admin_without_mfa' },
      });
      const access = this.issueTokens(user.id, user.email, user.role, false);
      const deviceToken = await this.issueDeviceToken(user.id, ip, ua);
      return { ...access, deviceToken, setupRequired: false as const };
    }

    await this.security.track('login_success', {
      userId: user.id,
      ip,
      userAgent: ua,
      severity: 'info',
      meta: { mfa: false },
    });
    const access = this.issueTokens(user.id, user.email, user.role, false);
    const deviceToken = await this.issueDeviceToken(user.id, ip, ua);
    return { ...access, deviceToken, setupRequired: false as const };
  }

  /** Auto-login via opaque device token (httpOnly cookie). */
  async autoLogin(rawDeviceToken: string | undefined, ip?: string, ua?: string) {
    if (!rawDeviceToken || rawDeviceToken.length < 32) return null;
    const hash = hashDeviceToken(rawDeviceToken);

    const row = await this.prisma.deviceToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt < new Date()) return null;
    if (row.user.status !== 'ACTIVE') return null;

    const prevPrefix = ipPrefix(row.ipAtIssue);
    const nowPrefix = ipPrefix(ip);
    if (prevPrefix && nowPrefix && prevPrefix !== nowPrefix) {
      await this.security.track('device_login_ip_changed', {
        userId: row.user.id,
        ip,
        userAgent: ua,
        severity: 'warn',
        meta: { prevPrefix, nowPrefix },
      });
    }
    if (row.userAgent && ua && row.userAgent.slice(0, 40) !== ua.slice(0, 40)) {
      await this.security.track('device_login_ua_changed', {
        userId: row.user.id,
        ip,
        userAgent: ua,
        severity: 'warn',
        meta: { prev: row.userAgent.slice(0, 40), now: ua.slice(0, 40) },
      });
    }

    const newRaw = newDeviceToken();
    await this.prisma.$transaction([
      this.prisma.deviceToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), lastSeenAt: new Date() },
      }),
      this.prisma.deviceToken.create({
        data: {
          userId: row.user.id,
          tokenHash: hashDeviceToken(newRaw),
          label: row.label,
          ipAtIssue: ip,
          userAgent: ua,
          expiresAt: new Date(Date.now() + DEVICE_TOKEN_DAYS * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    await this.security.track('auto_login', {
      userId: row.user.id,
      ip,
      userAgent: ua,
      severity: 'info',
      meta: {},
    });

    const access = this.issueTokens(row.user.id, row.user.email, row.user.role, row.user.mfaEnabled);
    return { ...access, deviceToken: newRaw };
  }

  async logoutByDeviceToken(rawDeviceToken: string | undefined) {
    if (!rawDeviceToken) return;
    const hash = hashDeviceToken(rawDeviceToken);
    await this.prisma.deviceToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listDevices(userId: string) {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label ?? 'Unknown device',
      ip: r.ipAtIssue,
      lastSeenAt: r.lastSeenAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  async revokeDevice(userId: string, id: string) {
    const row = await this.prisma.deviceToken.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new BadRequestException('NOT_FOUND');
    await this.prisma.deviceToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async revokeAllDevices(userId: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, profile: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      kycStatus: user.kycStatus,
      mfaEnabled: user.mfaEnabled,
      balance: Number(user.wallet?.balance ?? 0),
      currency: user.wallet?.currency ?? 'RC',
      locale: user.profile?.locale ?? 'ru',
      vipLevel: user.profile?.vipLevel ?? 0,
    };
  }

  // ─────────────────────── internals ───────────────────────

  private issueTokens(userId: string, email: string, role: string, mfaVerified: boolean) {
    const access = this.jwt.sign({ sub: userId, email, role, mfa: mfaVerified }, { expiresIn: '30d' });
    const refresh = this.jwt.sign({ sub: userId, typ: 'refresh' }, { expiresIn: '30d' });
    return { accessToken: access, refreshToken: refresh, mfaVerified, userId };
  }

  private async issueDeviceToken(userId: string, ip?: string, ua?: string): Promise<string> {
    const raw = newDeviceToken();
    await this.prisma.deviceToken.create({
      data: {
        userId,
        tokenHash: hashDeviceToken(raw),
        label: (ua ?? '').slice(0, 80) || null,
        ipAtIssue: ip,
        userAgent: ua,
        expiresAt: new Date(Date.now() + DEVICE_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return raw;
  }
}
