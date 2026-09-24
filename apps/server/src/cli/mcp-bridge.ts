import { createInterface } from 'node:readline';
import { LIMITS } from '../config/limits.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { relayToOwner } from './owner-client.ts';

function idOf(message: unknown): string | number | null {
  if (message && typeof message === 'object' && 'id' in message) {
    const id = message.id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

export async function runMcpBridge(
  dataDirectory: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: (line: string) => void = (line) => process.stdout.write(line),
  timeoutMs = LIMITS.owner.mcpTimeoutMs,
): Promise<void> {
  const socketPath = ownerSocketPath(dataDirectory);
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const id = idOf(message);
    try {
      const answer = await relayToOwner(
        socketPath,
        message,
        process.cwd(),
        timeoutMs,
      );
      if (answer.body.trim().length === 0) continue;
      if (answer.status !== 200) {
        if (id !== null) output(`${failure(id, answer.body)}\n`);
        continue;
      }
      output(`${answer.body.trim()}\n`);
    } catch (error) {
      if (id === null) continue;
      output(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message:
              error instanceof Error
                ? error.message
                : 'The Porcelain server could not be reached.',
          },
        })}\n`,
      );
    }
  }
}

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
