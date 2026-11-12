import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Response } from 'express';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { ReportsService } from './reports.service';

export class ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365)
  days: number = 30;

  @IsOptional() @IsIn(['json', 'csv'])
  format: 'json' | 'csv' = 'json';
}

@ApiTags('reports')
@ApiBearerAuth()
@RequirePermission('reports', 'read')
@Controller('platform/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** JSON: { days, rows: [{date,new_accounts,...}] }. ?format=csv returns a downloadable CSV. */
  @Get()
  async get(@Query() q: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const data = await this.reports.daily(q.days);
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="agentmart-activity-${q.days}d.csv"`);
      return this.reports.toCsv(data.rows);
    }
    return data;
  }
}
