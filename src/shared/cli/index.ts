import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CommandModule, CommandService } from 'nestjs-command';

import { AppModule } from '../../app.module';

async function bootstrap (): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log']
  });

  const logger = new Logger('CLI');

  try {
    const commandService = app.select(CommandModule).get(CommandService);
    await commandService.exec();

    logger.log('Command executed successfully');
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error executing command: ${error.message}`);
    } else {
      logger.error(`Error executing command: ${String(error)}`);
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error(`Error: ${error instanceof Error ? `${error.message}` : 'Unknown error'}`);
  process.exit(1);
});
