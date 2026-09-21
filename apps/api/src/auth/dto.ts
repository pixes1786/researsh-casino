import { IsEmail, IsString, Length, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @Length(3, 24) @Matches(/^[a-zA-Z0-9_]+$/) username!: string;
  @IsString() @Length(8, 128) password!: string;
}

export class LoginDto {
  /** Either email or username. */
  @IsString() @Length(3, 128) identifier!: string;
  @IsString() password!: string;
  @IsOptional() @IsString() @Length(6, 8) code?: string;
}

export class MfaCodeDto {
  @IsString() @Length(6, 8) code!: string;
}

export class MfaDisableDto {
  @IsString() @Length(6, 8) code!: string;
  @IsOptional() confirm?: boolean;
}
