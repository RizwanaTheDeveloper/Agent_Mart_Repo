import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ListQueryDto } from '../dto/list-query.dto';

/** Standard list envelope returned by every list endpoint. */
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export const toPage = <T>(items: T[], total: number, q: ListQueryDto): Page<T> => ({
  items,
  total,
  offset: q.offset,
  limit: q.limit,
});

/** Case-insensitive substring match. */
export const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });

/** Returns q when it is a UUID (so it can be matched against id columns without a Postgres cast error). */
export const uuidOrUndefined = (q?: string): string | undefined => (q && isUUID(q) ? q : undefined);

/** Validates a module-specific action name. */
export function ensureAction<T extends string>(action: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(action)) {
    throw new BadRequestException(`Unsupported action "${action}". Allowed: ${allowed.join(', ')}`);
  }
  return action as T;
}

export function requireField<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new BadRequestException(`"${name}" is required for this action`);
  }
  return value;
}
