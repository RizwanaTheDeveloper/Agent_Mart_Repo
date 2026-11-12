import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;

  /** Password or passphrase. */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class ElevateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}
