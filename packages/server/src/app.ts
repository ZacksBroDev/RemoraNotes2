import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttpModule from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { config } from './config/index.js';
import { logger } from './utils/index.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import routes from './routes/index.js';

const pinoHttp = pinoHttpModule.default ?? pinoHttpModule;

export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd,
    })
  );

  // CORS
  app.use(
    cors({
      origin: config.server.clientUrl,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Cookie parsing
  app.use(cookieParser());

  // Request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/api/v1/health',
      },
    })
  );

  // Trust proxy (for rate limiting, IP logging behind load balancer)
  if (config.isProd) {
    app.set('trust proxy', 1);
  }

  // API routes
  app.use('/api/v1', routes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
