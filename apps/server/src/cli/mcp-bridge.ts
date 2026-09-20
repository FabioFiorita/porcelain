import { request as httpRequest } from 'node:http';
import { createInterface } from 'node:readline';
import { ownerSocketPath } from '../lifecycle/owner-socket.ts';

/** What the Streamable HTTP transport requires of every caller. */
const accept = 'application/json, text/event-stream';

type Answer = { status: number; body: string };

/**
 * One JSON-RPC exchange over the owner socket.
 *
 * This does not reuse the owner client: the MCP transport refuses any request
 * that does not accept both JSON and an event stream, and it answers a
 * notification with 202 and no body. A request path built for the plain owner
 * routes gets 406 for everything, which is the whole agent door.
 */
function exchange(
  socketPath: string,
  message: unknown,
  timeoutMs: number,
): Promise<Answer> {
  const payload = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const call = httpRequest(
      {
        socketPath,
        path: '/mcp',
        method: 'POST',
        timeout: timeoutMs,
        agent: false,
        headers: {
          accept,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    call.on('timeout', () =>
      call.destroy(new Error('The Porcelain server did not answer in time.')),
    );
    call.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
          ? new Error('Porcelain is not running.')
          : error,
      ),
    );
    call.write(payload);
    call.end();
  });
}

function idOf(message: unknown): string | number | null {
  if (message && typeof message === 'object' && 'id' in message) {
    const id = (message as { id: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

/**
 * Bridge an agent's stdio MCP transport to the server's local socket.
 *
 * This is why an agent needs no secret anywhere: `claude mcp add porcelain --
 * porcelain mcp` is the whole configuration, and file permissions on the socket
 * are the authentication. The socket's MCP route declares the caller an agent,
 * so what it writes is attributed to an agent rather than to the owner whose
 * file access got it in.
 */
export async function runMcpBridge(
  dataDirectory: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: (line: string) => void = (line) => process.stdout.write(line),
  timeoutMs = 120_000,
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
      // A line that is not JSON-RPC is not ours to answer.
      continue;
    }
    const id = idOf(message);
    try {
      const answer = await exchange(socketPath, message, timeoutMs);
      // A notification is accepted with 202 and no body, and expects no reply.
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
  // The server may already have answered in JSON-RPC; pass that through rather
  // than wrapping an error inside an error.
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed)
      return JSON.stringify(parsed);
  } catch {
    // Not JSON-RPC; report it as a transport failure below.
  }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: 'The Porcelain server refused the request.',
    },
  });
}
