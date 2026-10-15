import type { Server } from 'node:http';
import type { Logger } from 'pino';

interface ShutdownDeps {
  server: Server;
  disconnect: () => Promise<void>;
  logger: Logger;
  exit: (code: number) => void;
  timeoutMs?: number;
}

export function createGracefulShutdown({
  server,
  disconnect,
  logger,
  exit,
  timeoutMs = 10_000,
}: ShutdownDeps): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      exit(1);
    }, timeoutMs);
    forceExit.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      });
      await disconnect();
      clearTimeout(forceExit);
      exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      clearTimeout(forceExit);
      exit(1);
    }
  };
}
