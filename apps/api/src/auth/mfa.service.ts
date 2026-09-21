import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const ISSUER = 'ResearchCasino';

@Injectable()
export class MfaService {
  constructor(private prisma: PrismaService) {}

  async status(userId: string) {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      enabled: user.mfaEnabled,
      pending: !!row && !row.confirmedAt,
      confirmedAt: row?.confirmedAt ?? null,
      recoveryCodesLeft: row?.recoveryCodes?.length ?? 0,
    };
  }

  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new BadRequestException('MFA_ALREADY_ENABLED');

    const secret = speakeasy.generateSecret({
      name: `${ISSUER} (${user.email})`,
      issuer: ISSUER,
      length: 20,
    });

    const otpauth = secret.otpauth_url!;
    const base32 = secret.base32;
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));

    await this.prisma.mfaSecret.upsert({
      where: { userId },
      update: { secret: base32, recoveryCodes, confirmedAt: null },
      create: { userId, secret: base32, recoveryCodes },
    });

    return { otpauth, qrDataUrl, secret: base32, recoveryCodes };
  }

  async enable(userId: string, code: string) {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row) throw new BadRequestException('MFA_NOT_SETUP');
    if (row.confirmedAt) throw new BadRequestException('MFA_ALREADY_ENABLED');

    const ok = this.verifyTotp(row.secret, code);
    if (!ok) throw new UnauthorizedException('BAD_TOTP');

    await this.prisma.mfaSecret.update({
      where: { userId },
      data: { confirmedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });

    return { enabled: true };
  }

  async disable(userId: string, code: string) {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row || !row.confirmedAt) throw new BadRequestException('MFA_NOT_ENABLED');
    const ok = this.verifyTotp(row.secret, code);
    if (!ok) throw new UnauthorizedException('BAD_TOTP');

    await this.prisma.mfaSecret.delete({ where: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false } });
    return { enabled: false };
  }

  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row || !row.confirmedAt) return false;
    if (this.verifyTotp(row.secret, code)) return true;

    const idx = row.recoveryCodes.indexOf(code.toLowerCase());
    if (idx >= 0) {
      const updated = row.recoveryCodes.filter((_, i) => i !== idx);
      await this.prisma.mfaSecret.update({
        where: { userId },
        data: { recoveryCodes: updated },
      });
      return true;
    }
    return false;
  }

  private verifyTotp(secretBase32: string, code: string): boolean {
    try {
      const clean = code.replace(/\s+/g, '');
      return speakeasy.totp.verify({
        secret: secretBase32,
        encoding: 'base32',
        token: clean,
        window: 1,
      });
    } catch {
      return false;
    }
  }

  async assertAdminHasMfa(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const adminRoles = ['ADMIN', 'SUPERADMIN', 'RISK'];
    if (adminRoles.includes(u.role) && !u.mfaEnabled) {
      throw new UnauthorizedException('MFA_REQUIRED_FOR_ADMIN');
    }
  }
}
