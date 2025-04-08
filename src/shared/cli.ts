import { NestFactory } from '@nestjs/core';
import { CommandModule, CommandService } from 'nestjs-command';
import { AppModule } from '../app.module';
import { Logger } from '@nestjs/common';

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

bootstrap();
