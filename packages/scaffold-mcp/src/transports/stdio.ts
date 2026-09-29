import type { Readable } from 'node:stream';
import type { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { TransportHandler } from './types.js';

/** One stdio client owns this transport, including when its pipe closes without a signal. */
export class StdioTransportHandler implements TransportHandler {
  private transport: StdioServerTransport | null = null;
  private stopPromise: Promise<void> | undefined;
  private readonly onInputClosed = (): void => {
    void this.stop().catch((error: unknown) =>
      console.error('Scaffold stdio cleanup failed:', error),
    );
  };

  constructor(
    private readonly server: Server,
    private readonly input: Readable = process.stdin,
  ) {}

  async start(): Promise<void> {
    if (this.transport || this.stopPromise)
      throw new Error('Scaffold stdio transport cannot be started twice');
    this.transport = new StdioServerTransport();
    this.input.on('end', this.onInputClosed);
    this.input.on('close', this.onInputClosed);
    if (this.input.readableEnded || this.input.destroyed) {
      await this.stop();
      return;
    }
    try {
      await this.server.connect(this.transport);
      // A late connection must not survive an EOF received during the handshake.
      if (this.stopPromise) await this.server.close();
      else console.error('Scaffolding MCP server started on stdio');
    } catch (error) {
      await this.stop().catch(() => undefined);
      throw error;
    }
  }

  stop(): Promise<void> {
    this.stopPromise ??= (async () => {
      this.input.off('end', this.onInputClosed);
      this.input.off('close', this.onInputClosed);
      const transport = this.transport;
      this.transport = null;
      const results = await Promise.allSettled([
        Promise.resolve().then(() => this.server.close()),
        Promise.resolve().then(() => transport?.close()),
      ]);
      const errors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason] : [],
      );
      if (errors.length) throw new AggregateError(errors, 'Scaffold stdio cleanup failed');
    })();
    return this.stopPromise;
  }
}
