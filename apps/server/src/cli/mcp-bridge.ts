import { Cause, Effect, Queue, Stream } from 'effect';
import { createInterface } from 'node:readline';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { relayToOwner } from './owner-client.ts';

function methodOf(message: unknown): string | null {
  if (message && typeof message === 'object' && 'method' in message) {
    const method = message.method;
    if (typeof method === 'string') return method;
  }
  return null;
}

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
  const handshake: { initialize?: unknown; initialized?: unknown } = {};
  const send = Effect.fn('McpBridge.send')(function* (message: unknown) {
    const answer = yield* relayToOwner(
      socketPath,
      message,
      process.cwd(),
      timeoutMs,
      sessionHeaders,
    );
    const sessionId = answer.headers.get('mcp-session-id');
    if (sessionId !== null) sessionHeaders['mcp-session-id'] = sessionId;
    const protocolVersion = answer.headers.get('mcp-protocol-version');
    if (protocolVersion !== null)
      sessionHeaders['mcp-protocol-version'] = protocolVersion;
    return answer;
  });
  const renewSession = Effect.fn('McpBridge.renewSession')(function* (
    initialize: unknown,
  ) {
    delete sessionHeaders['mcp-session-id'];
    delete sessionHeaders['mcp-protocol-version'];
    const answer = yield* send(initialize);
    if (!accepted(answer.status)) return false;
    if (handshake.initialized !== undefined) yield* send(handshake.initialized);
    return true;
  });
  const answerTo = Effect.fn('McpBridge.answerTo')(function* (
    message: unknown,
  ) {
    const method = methodOf(message);
    if (method === 'initialize') handshake.initialize = message;
    if (method === 'notifications/initialized') handshake.initialized = message;
    const sentSession = sessionHeaders['mcp-session-id'] !== undefined;
    const answer = yield* send(message);
    const sessionForgotten =
      answer.status === 404 && sentSession && method !== 'initialize';
    if (!sessionForgotten || handshake.initialize === undefined) return answer;
    if (!(yield* renewSession(handshake.initialize))) return answer;
    return yield* send(message);
  });
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
      yield* answerTo(message).pipe(
        Effect.map((answer) => {
          if (!accepted(answer.status)) {
            if (id !== null)
              output(`${failure(id, answer.status, answer.body)}\n`);
            return;
          }
          if (answer.body.trim().length === 0) return;
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

function accepted(status: number): boolean {
  return status >= 200 && status < 300;
}

function failure(id: string | number, status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed)
      return JSON.stringify({ ...parsed, id });
  } catch {}
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: `The Porcelain server refused the request with HTTP ${status}.`,
    },
  });
}
