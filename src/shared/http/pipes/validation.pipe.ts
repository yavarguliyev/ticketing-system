import { ValidationPipe, ValidationError, BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor () {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = this.formatErrors(errors);
        return new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: messages
        });
      }
    });
  }

  private formatErrors (errors: ValidationError[]): string[] {
    return errors.flatMap((error) => {
      if (error.children?.length) {
        return this.formatErrors(error.children);
      }

      return Object.values(error.constraints || {}).map((message) => `${error.property}: ${message}`);
    });
  }
}
