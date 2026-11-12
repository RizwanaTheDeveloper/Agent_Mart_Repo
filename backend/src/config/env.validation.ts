import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/** Typed, validated environment. Access through ConfigService<EnvVars, true>. */
export class EnvVars {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number) @IsInt() @Min(1) @Max(65535)
  PORT = 3000;

  @IsString() @MinLength(1)
  DATABASE_URL: string;

  @IsOptional() @IsString()
  CORS_ORIGINS?: string;

  @Transform(toBool) @IsBoolean()
  REQUIRE_HTTPS = false;

  @Transform(toBool) @IsBoolean()
  SWAGGER_ENABLED = true;

  @Type(() => Number) @IsInt() @Min(5) @Max(720)
  SESSION_TTL_MINUTES = 120;

  @Type(() => Number) @IsInt() @Min(1) @Max(60)
  ELEVATION_TTL_MINUTES = 10;

  @IsString() @MinLength(1)
  PLOT_CODE_REGEX = '^[A-Z0-9]{2,10}(-[A-Z0-9]{1,12}){1,4}$';
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n${errors.map((e) => ` - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n')}`);
  }
  try {
    new RegExp(env.PLOT_CODE_REGEX);
  } catch {
    throw new Error('PLOT_CODE_REGEX is not a valid regular expression');
  }
  return env;
}
