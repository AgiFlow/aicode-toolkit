import { PassThrough } from 'node:stream';
import type { Server } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StdioTransportHandler } from '../../src/transports/stdio';

const mocks = vi.hoisted(() => ({ close: vi.fn() }));
vi.mock('@modelcontextprotocol/server/stdio', () => ({
  StdioServerTransport: class {
    close = mocks.close;
  },
}));

const handlers: StdioTransportHandler[] = [];
beforeEach(() => {
  mocks.close.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await Promise.allSettled(handlers.splice(0).map((handler) => handler.stop()));
});

function fixture(connect = vi.fn().mockResolvedValue(undefined)) {
  const input = new PassThrough();
  const server = { connect, close: vi.fn().mockResolvedValue(undefined) };
  const handler = new StdioTransportHandler(server as unknown as Server, input);
  handlers.push(handler);
  return { input, server, handler };
}

describe('stdio ownership', () => {
  it.each(['end', 'close'])('closes on stdin %s without a signal', async (event) => {
    const { input, server, handler } = fixture();
    await handler.start();
    input.emit(event);
    await handler.stop();
    expect(server.close).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(input.listenerCount('end')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
    await handler.stop();
    expect(server.close).toHaveBeenCalledOnce();
  });

  it('does not connect an already-closed input', async () => {
    const { input, server, handler } = fixture();
    input.destroy();
    await handler.start();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('closes a connection that finishes after EOF', async () => {
    let finish!: () => void;
    const { input, server, handler } = fixture(
      vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const starting = handler.start();
    input.emit('end');
    await handler.stop();
    finish();
    await starting;
    expect(server.close).toHaveBeenCalledTimes(2);
  });

  it('attempts transport cleanup even when server cleanup fails', async () => {
    const { input, server, handler } = fixture();
    await handler.start();
    server.close.mockRejectedValueOnce(new Error('fixture failure'));
    await expect(handler.stop()).rejects.toThrow('Scaffold stdio cleanup failed');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(input.listenerCount('end')).toBe(0);
  });
});
