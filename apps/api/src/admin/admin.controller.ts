import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { SecurityService } from '../security/security.service';
import { JwtGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';

class UpdateUserDto {
  @IsOptional() @IsIn(['USER','MODERATOR','SUPPORT','RISK','ADMIN','SUPERADMIN']) role?: Role;
  @IsOptional() @IsIn(['ACTIVE','SUSPENDED','SELF_EXCLUDED']) status?: string;
  @IsOptional() @IsIn(['UNVERIFIED','PENDING','VERIFIED','REJECTED']) kycStatus?: string;
  @IsOptional() @IsString() reason?: string;
}

class AdjustBalanceDto {
  @IsNumber() delta!: number;
  @IsString() @MinLength(3) reason!: string;
}

class UpdateGameDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() @Min(80) rtp?: number;
  @IsOptional() @IsNumber() @Min(0) playersNow?: number;
  @IsOptional() @IsString() reason?: string;
}

@Controller('admin')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN', 'RISK', 'SUPPORT', 'MODERATOR')
export class AdminController {
  constructor(private admin: AdminService, private security: SecurityService) {}

  @Get('dashboard')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK')
  dashboard() { return this.admin.dashboard(); }

  @Get('users')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK', 'SUPPORT', 'MODERATOR')
  users(
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('status') status?: string,
  ) { return this.admin.users({ search, role, status }); }

  @Get('users/:id')
  user(@Param('id') id: string) { return this.admin.user(id); }

  @Patch('users/:id')
  @Roles('ADMIN', 'SUPERADMIN')
  updateUser(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) { return this.admin.updateUser(u.sub, id, dto, ); }

  @Post('users/:id/balance')
  @Roles('ADMIN', 'SUPERADMIN')
  adjustBalance(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
  ) { return this.admin.adjustBalance(u.sub, id, dto.delta, dto.reason); }

  @Get('games')
  games() { return this.admin.games(); }

  @Patch('games/:id')
  @Roles('ADMIN', 'SUPERADMIN')
  updateGame(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
  ) { return this.admin.updateGame(u.sub, id, dto); }

  @Get('ledger')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK')
  ledger(@Query('type') type?: string, @Query('limit') limit?: string) {
    return this.admin.ledger({ type, limit: limit ? +limit : 100 });
  }

  @Get('audit')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK')
  audit(@Query('limit') limit?: string) {
    return this.admin.audit(limit ? +limit : 100);
  }

  @Get('security')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK')
  securityList(
    @Query('kind') kind?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    return this.security.list({ kind, severity, limit: limit ? +limit : 200 });
  }

  @Get('security/summary')
  @Roles('ADMIN', 'SUPERADMIN', 'RISK')
  securitySummary() {
    return this.security.summary();
  }
}
