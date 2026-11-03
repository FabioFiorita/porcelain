import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const UNREGISTERED_TOKEN_MARK = 'Unregistered';
const UNANSWERED_TOKEN_MARK = 'Unanswered';
const PUSH_PATH = '/--/api/v2/push/send';

function ticketFor(message: unknown) {
  const to =
    message !== null && typeof message === 'object' && 'to' in message
      ? message.to
      : undefined;
  return typeof to === 'string' && to.includes(UNREGISTERED_TOKEN_MARK)
    ? {
        status: 'error',
        message: `${to} is not a registered push notification recipient`,
        details: { error: 'DeviceNotRegistered' },
      }
    : { status: 'ok', id: crypto.randomUUID() };
}

export async function startRecordingPushService(file: string) {
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      const messages: unknown = JSON.parse(body || 'null');
      appendFileSync(
        file,
        `${JSON.stringify({ method: request.method, path: request.url, messages })}\n`,
      );
      const batch = Array.isArray(messages) ? messages : [messages];
      if (JSON.stringify(batch).includes(UNANSWERED_TOKEN_MARK)) {
        response.once('close', () =>
          appendFileSync(file, `${JSON.stringify({ abandoned: true })}\n`),
        );
        return;
      }
      response.writeHead(request.url === PUSH_PATH ? 200 : 404, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify({ data: batch.map(ticketFor) }));
    });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('The fake push service has no port');
  const { port } = address;
  return {
    endpoint: `http://127.0.0.1:${port}${PUSH_PATH}`,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.closeAllConnections();
        server.close(() => resolveClose());
      }),
  };
}
