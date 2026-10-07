import { Cause, Effect, Queue, Stream } from 'effect';
import { createInterface } from 'node:readline';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { relayToOwner } from './owner-client.ts';

function idOf(message: unknown): string | number | null {
  if (message && typeof message === 'object' && 'id' in message) {
    const id = message.id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

export const runMcpBridge = Effect.fn('runMcpBridge')(function* (
  dataDirectory: string,
  timeoutMs: number,
  input: NodeJS.ReadableStream = process.stdin,
  output: (line: string) => void = (line) => process.stdout.write(line),
) {
  const socketPath = ownerSocketPath(dataDirectory);
  const sessionHeaders: Record<string, string> = {};
  const lines = Stream.callback<string>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const reader = createInterface({
          input,
          crlfDelay: Number.POSITIVE_INFINITY,
        });
        reader.on('line', (line) => Queue.offerUnsafe(queue, line));
        reader.on('close', () => Queue.endUnsafe(queue));
        reader.on('error', (error) =>
          Queue.failCauseUnsafe(queue, Cause.die(error)),
        );
        return reader;
      }),
      (reader) =>
        Effect.sync(() => {
          reader.close();
          input.pause();
        }),
    ),
  );
  yield* Stream.runForEach(
    lines,
    Effect.fn('McpBridge.relay')(function* (line) {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      let message: unknown;
      try {
        message = JSON.parse(trimmed);
      } catch {
        return;
      }
      const id = idOf(message);
      yield* relayToOwner(
        socketPath,
        message,
        process.cwd(),
        timeoutMs,
        sessionHeaders,
      ).pipe(
        Effect.map((answer) => {
          const sessionId = answer.headers.get('mcp-session-id');
          if (sessionId !== null) sessionHeaders['mcp-session-id'] = sessionId;
          const protocolVersion = answer.headers.get('mcp-protocol-version');
          if (protocolVersion !== null)
            sessionHeaders['mcp-protocol-version'] = protocolVersion;
          if (answer.body.trim().length === 0) return;
          if (answer.status !== 200) {
            if (id !== null) output(`${failure(id, answer.body)}\n`);
            return;
          }
          output(`${answer.body.trim()}\n`);
        }),
        Effect.catch((error) =>
          Effect.sync(() => {
            if (id === null) return;
            output(
              `${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: error.message } })}\n`,
            );
          }),
        ),
      );
    }),
  );
});

function failure(id: string | number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed)
      return JSON.stringify(parsed);
  } catch {}
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: 'The Porcelain server refused the request.',
    },
  });
}
