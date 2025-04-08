import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { AppThrottlerGuard } from './shared/guards/throttler.guard';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AppValidationPipe } from './shared/pipes/validation.pipe';
import { DatabaseLockExceptionFilter } from './shared/filters/database-lock.filter';
import { OptimisticLockExceptionFilter } from './shared/filters/optimistic-lock.filter';

async function bootstrap (): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableCors();

  app.useGlobalPipes(new AppValidationPipe());

  const throttlerGuard: AppThrottlerGuard = app.get(AppThrottlerGuard);
  app.useGlobalGuards(throttlerGuard);

  const loggingInterceptor: LoggingInterceptor = app.get(LoggingInterceptor);
  app.useGlobalInterceptors(loggingInterceptor);

  app.useGlobalFilters(
    new DatabaseLockExceptionFilter(),
    new OptimisticLockExceptionFilter()
  );

  const config = new DocumentBuilder()
    .setTitle('Ticketing System API')
    .setDescription('A robust ticketing system with proper concurrency handling')
    .setVersion('1.0')
    .addTag('tickets')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
}

bootstrap();
