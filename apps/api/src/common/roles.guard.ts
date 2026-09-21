import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user;
    if (!user?.role) throw new ForbiddenException('NO_ROLE');
    if (!required.includes(user.role)) throw new ForbiddenException('INSUFFICIENT_ROLE');

    // MFA-for-admin enforcement temporarily disabled.
    // Re-enable once we're ready to enforce 2FA on every admin session.
    //
    // const mfaRequiredRoles = ['ADMIN', 'SUPERADMIN', 'RISK'];
    // if (mfaRequiredRoles.includes(user.role) && user.mfa !== true) {
    //   throw new ForbiddenException('MFA_REQUIRED');
    // }

    return true;
  }
}
