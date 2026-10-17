import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ENVIRONMENT, type Environment } from './config/environment';
import type { Request, Response, NextFunction } from 'express';

export async function createApp(logger: false | undefined = undefined) {
  const app = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false,
  });
  const environment = app.get<Environment>(ENVIRONMENT);
  if (environment.dataScope === 'local_pilot')
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Matanexa-Data-Scope', 'local_pilot');
      if (
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
          req.socket.remoteAddress ?? '',
        ) ||
        !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')
      ) {
        res.status(403).json({
          error: {
            code: 'LOCAL_RESEARCH_ONLY',
            message: 'Pilot riset hanya dapat diakses melalui localhost.',
          },
        });
        return;
      }
      next();
    });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: environment.corsOrigins,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    credentials: false,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
