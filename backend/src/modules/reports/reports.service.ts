import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DailyActivity {
  date: string;
  new_accounts: number;
  new_listings: number;
  new_interests: number;
  new_cases: number;
  admin_actions: number;
}

export const REPORT_COLUMNS: (keyof DailyActivity)[] = [
  'date',
  'new_accounts',
  'new_listings',
  'new_interests',
  'new_cases',
  'admin_actions',
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Daily activity counts for the last `days` days (UTC), including days with zero activity. */
  async daily(days: number): Promise<{ days: number; rows: DailyActivity[] }> {
    const rows = await this.prisma.$queryRaw<DailyActivity[]>`
      WITH d AS (
        SELECT generate_series(
          (now() AT TIME ZONE 'UTC')::date - (${days}::int - 1),
          (now() AT TIME ZONE 'UTC')::date,
          interval '1 day'
        )::date AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        (SELECT count(*)::int FROM accounts   x WHERE (x.created_at AT TIME ZONE 'UTC')::date = d.day) AS new_accounts,
        (SELECT count(*)::int FROM listings   x WHERE (x.created_at AT TIME ZONE 'UTC')::date = d.day) AS new_listings,
        (SELECT count(*)::int FROM interests  x WHERE (x.created_at AT TIME ZONE 'UTC')::date = d.day) AS new_interests,
        (SELECT count(*)::int FROM cases      x WHERE (x.created_at AT TIME ZONE 'UTC')::date = d.day) AS new_cases,
        (SELECT count(*)::int FROM audit_logs x WHERE (x.created_at AT TIME ZONE 'UTC')::date = d.day) AS admin_actions
      FROM d
      ORDER BY d.day`;
    return { days, rows };
  }

  toCsv(rows: DailyActivity[]): string {
    const lines = [REPORT_COLUMNS.join(',')];
    for (const r of rows) lines.push(REPORT_COLUMNS.map((c) => String(r[c])).join(','));
    return lines.join('\r\n') + '\r\n';
  }
}
