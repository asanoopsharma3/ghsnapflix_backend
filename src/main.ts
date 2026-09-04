import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

function parseCorsOrigins(value: string | undefined): boolean | string[] {
  if (!value || value.trim() === '' || value.trim() === '*') {
    return true;
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const corsEnabled = process.env.CORS_ENABLED !== 'false';
  if (corsEnabled) {
    app.enableCors({
      origin: parseCorsOrigins(process.env.CORS_ORIGIN),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'x-api-key',
        'transactionid',
      ],
    });
  }

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'api/callback', method: RequestMethod.ALL }],
  });
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Application listening on port ${port}`);
  if (corsEnabled) {
    console.log('CORS enabled');
  }
}
bootstrap();