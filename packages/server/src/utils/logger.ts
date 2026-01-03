import pinoModule from 'pino';
import { config } from '../config/index.js';

const pino = pinoModule.default ?? pinoModule;

// Redact sensitive fields
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'email',
  'phone',
  'token',
  'refreshToken',
  'accessToken',
  'password',
  'secret',
];

export const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
});

export type Logger = typeof logger;
