import type { Server } from 'node:http';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createGracefulShutdown } from '../../src/shared/utils/gracefulShutdown.js';

const logger = pino({ level: 'silent' });

function fakeServer(closeError?: Error): Server {
  return {
    close: vi.fn((callback: (error?: Error) => void) => {
      callback(closeError);
    }),
    closeIdleConnections: vi.fn(),
  } as unknown as Server;
}

describe('createGracefulShutdown', () => {
  it('closes the server, disconnects and exits with 0', async () => {
    const server = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    await createGracefulShutdown({ server, disconnect, logger, exit })('SIGTERM');

    expect(server.close).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits with 1 when closing fails', async () => {
    const exit = vi.fn();
    await createGracefulShutdown({
      server: fakeServer(new Error('boom')),
      disconnect: vi.fn().mockResolvedValue(undefined),
      logger,
      exit,
    })('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores repeated signals', async () => {
    const server = fakeServer();
    const shutdown = createGracefulShutdown({
      server,
      disconnect: vi.fn().mockResolvedValue(undefined),
      logger,
      exit: vi.fn(),
    });
    await shutdown('SIGTERM');
    await shutdown('SIGINT');
    expect(server.close).toHaveBeenCalledOnce();
  });
});
