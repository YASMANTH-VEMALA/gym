import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '3mb' });
  app.enableCors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('Gym SaaS API')
    .setDescription('Initial project foundation')
    .setVersion('0.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(3001);
}
void bootstrap();
