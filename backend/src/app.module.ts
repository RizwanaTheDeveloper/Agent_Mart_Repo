import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { validateEnv } from './config/env.validation';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AdminsModule } from './modules/admins/admins.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FirmsModule } from './modules/firms/firms.module';
import { HealthController } from './modules/health/health.controller';
import { ImportsModule } from './modules/imports/imports.module';
import { InterestsModule } from './modules/interests/interests.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OverviewModule } from './modules/overview/overview.module';
import { PlansModule } from './modules/plans/plans.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SummariesModule } from './modules/summaries/summaries.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    // 15 sidebar modules
    OverviewModule,
    ReportsModule,
    FirmsModule,
    SubscriptionsModule,
    AccountsModule,
    ListingsModule,
    CasesModule,
    InterestsModule,
    DocumentsModule,
    SummariesModule,
    PlansModule,
    AnnouncementsModule,
    ImportsModule,
    SettingsModule,
    AdminsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit -> authenticate -> authorise (+ elevation).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
