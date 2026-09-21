import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.access_token ?? req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('NO_TOKEN');
    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('BAD_TOKEN');
    }
  }
}
