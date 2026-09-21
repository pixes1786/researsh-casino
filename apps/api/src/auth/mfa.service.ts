import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { generateSecret, generate, verify, generateURI } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

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

    const secret = generateSecret();
    const otpauth = generateURI({
      issuer: 'ResearchCasino',
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));

    await this.prisma.mfaSecret.upsert({
      where: { userId },
      update: { secret, recoveryCodes, confirmedAt: null },
      create: { userId, secret, recoveryCodes },
    });

    return { otpauth, qrDataUrl, secret, recoveryCodes };
  }

  async enable(userId: string, code: string) {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row) throw new BadRequestException('MFA_NOT_SETUP');
    if (row.confirmedAt) throw new BadRequestException('MFA_ALREADY_ENABLED');

    const ok = await this.verifyTotp(row.secret, code);
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
    const ok = await this.verifyTotp(row.secret, code);
    if (!ok) throw new UnauthorizedException('BAD_TOTP');

    await this.prisma.mfaSecret.delete({ where: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false } });
    return { enabled: false };
  }

  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row || !row.confirmedAt) return false;
    if (await this.verifyTotp(row.secret, code)) return true;

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

  private async verifyTotp(secret: string, code: string): Promise<boolean> {
    try {
      const clean = code.replace(/\s+/g, '');
      const result = await verify({ secret, token: clean });
      // v13: verify возвращает объект { valid: boolean, delta?: number }
      return typeof result === 'boolean' ? result : (result as any).valid === true;
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
