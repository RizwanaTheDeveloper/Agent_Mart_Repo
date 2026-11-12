import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const MAP: Record<string, [number, string]> = {
  P2002: [409, 'A record with this value already exists'],
  P2003: [409, 'Related record constraint failed'],
  P2025: [404, 'Record not found'],
};

/** Converts known Prisma errors into clean HTTP responses instead of 500s. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const hit = MAP[exception.code];
    if (!hit) return super.catch(exception, host);
    const res = host.switchToHttp().getResponse<Response>();
    res.status(hit[0]).json({ statusCode: hit[0], message: hit[1], error: exception.code });
  }
}
