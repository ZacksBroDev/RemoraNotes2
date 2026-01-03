import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/index.js';
import { createApp } from './app.js';

async function main() {
  try {
    // Connect to database
    await connectDatabase();

    // Create and start server
    const app = createApp();
    const server = app.listen(config.server.port, () => {
      logger.info(`🚀 Server running on port ${config.server.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.server.apiUrl}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          const { disconnectDatabase } = await import('./config/database.js');
          await disconnectDatabase();
          process.exit(0);
        } catch (error) {
          logger.error({ error }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
