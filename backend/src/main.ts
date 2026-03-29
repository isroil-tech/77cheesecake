import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase JSON body limit for base64 image payloads (screenshots ~5MB → base64 ~7MB)
  // CRASH TEST PATCH: Reduced to 4mb to prevent Out of Memory DDOS attacks from fake receipts
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').json({ limit: '4mb' }));

  // Enable CORS for Mini App
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-telegram-id'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
}
bootstrap();
