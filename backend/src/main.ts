import 'reflect-metadata';
import { Logger, ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { requireHttps } from './common/middleware/require-https.middleware';
import { EnvVars } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<EnvVars, true>>(ConfigService);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.set('trust proxy', 1);
  app.use(helmet());
  if (config.get('REQUIRE_HTTPS', { infer: true })) app.use(requireHttps);

  // Import previews may be up to 750 KB of JSON; leave headroom for the envelope.
  app.useBodyParser('json', { limit: '1mb' });

  const origins = (config.get('CORS_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Version', 'Accept-Language'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });

  // All routes live under /api. Paths match the APK contract (/api/platform/...).
  // Versioning: clients may send `X-API-Version: 1`; requests without it resolve to v1.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.HEADER, header: 'X-API-Version', defaultVersion: [VERSION_NEUTRAL, '1'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true }) && !isProd) {
    const doc = new DocumentBuilder()
      .setTitle('Agent Mart | Platform Admin API')
      .setDescription('Backend for the Agent Mart administrator app. All mutations require an audit `reason` (>= 5 chars).')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`Agent Mart admin API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
