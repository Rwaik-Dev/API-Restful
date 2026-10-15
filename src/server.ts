import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createGracefulShutdown } from './shared/utils/gracefulShutdown.js';

async function start(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'HTTP server listening');
  });
  server.requestTimeout = env.REQUEST_TIMEOUT_MS;
  server.headersTimeout = Math.min(env.REQUEST_TIMEOUT_MS, 60_000);
  server.keepAliveTimeout = 5_000;

  const shutdown = createGracefulShutdown({
    server,
    disconnect: disconnectDatabase,
    logger,
    exit: (code) => process.exit(code),
  });

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => void shutdown(signal));
  }
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
