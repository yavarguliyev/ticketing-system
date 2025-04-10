import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { AppThrottlerGuard } from './shared/http/guards/throttler.guard';
import { LoggingInterceptor } from './shared/http/interceptors/logging.interceptor';
import { AppValidationPipe } from './shared/http/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app: INestApplication = await NestFactory.create(AppModule);
  const port: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableCors();

  app.useGlobalPipes(new AppValidationPipe());

  const throttlerGuard: AppThrottlerGuard = app.get(AppThrottlerGuard);
  app.useGlobalGuards(throttlerGuard);

  const loggingInterceptor: LoggingInterceptor = app.get(LoggingInterceptor);
  app.useGlobalInterceptors(loggingInterceptor);

  const config = new DocumentBuilder()
    .setTitle('Ticketing System API')
    .setDescription('A robust ticketing system with proper concurrency handling')
    .setVersion('1.0')
    .addTag('tickets')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port, () => logger.log(`Service running on port ${port}`));
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error(`Error: ${error instanceof Error ? `${error.message}` : 'Unknown error'}`);
  process.exit(1);
});
