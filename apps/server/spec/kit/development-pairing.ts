import { request, type IncomingMessage, type ServerResponse } from 'node:http';
import { Schema } from 'effect';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function developmentPairing(input: {
  ownerSocket: string;
  serverAddress: string;
  label: string;
  response: 'redirect' | 'link';
}) {
  return (incoming: IncomingMessage, out: ServerResponse, next: () => void) => {
    if (incoming.url !== '/__porcelain/dev/pair') return next();
    if (incoming.method !== 'POST') {
      out.statusCode = 405;
      out.setHeader('allow', 'POST');
      out.end();
      return;
    }
    if (!loopback.has(incoming.socket.remoteAddress ?? '')) {
      out.statusCode = 403;
      out.end('Development pairing only answers this machine.\n');
      return;
    }
    out.setHeader('cache-control', 'no-store');
    issueLink(input).then(
      (link) => {
        if (input.response === 'redirect') {
          out.statusCode = 303;
          out.setHeader('location', link);
          out.end();
        } else {
          out.setHeader('content-type', 'text/plain; charset=utf-8');
          out.end(link);
        }
      },
      (error: unknown) => {
        out.statusCode = 502;
        out.setHeader('content-type', 'text/plain; charset=utf-8');
        out.end(
          `Could not create a development pairing link: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      },
    );
  };
}

function issueLink(input: {
  ownerSocket: string;
  serverAddress: string;
  label: string;
  response: 'redirect' | 'link';
}) {
  const body = JSON.stringify({
    labels: [input.label],
    addresses: [input.serverAddress],
  });
  return new Promise<string>((resolve, reject) => {
    const asked = request(
      {
        socketPath: input.ownerSocket,
        path: '/pairings',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (answer) => {
        const chunks: Buffer[] = [];
        answer.on('data', (chunk: Buffer) => chunks.push(chunk));
        answer.on('error', reject);
        answer.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (answer.statusCode !== 200) {
            reject(new Error(`the owner answered ${answer.statusCode}`));
            return;
          }
          try {
            const [grant] = Schema.decodeUnknownSync(
              Schema.fromJsonString(issuePairingResponseSchema),
            )(text).grants;
            if (grant === undefined) {
              reject(new Error('the owner issued no grant'));
              return;
            }
            resolve(
              pairingLink({
                addresses:
                  input.response === 'redirect' ? [''] : [input.serverAddress],
                code: grant.link.code,
                environmentId: grant.link.environmentId,
              }),
            );
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    asked.setTimeout(15_000, () =>
      asked.destroy(new Error('the owner did not answer in time')),
    );
    asked.on('error', reject);
    asked.end(body);
  });
}
