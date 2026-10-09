import { request } from 'node:http';
import { Schema } from 'effect';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import type { Plugin } from 'vite';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function devPair(ownerSocket: string, serverAddress: string): Plugin {
  return {
    name: 'porcelain-dev-pair',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__porcelain/dev/pair', (incoming, out, next) => {
        if (incoming.method !== 'POST') return next();
        if (!loopback.has(incoming.socket.remoteAddress ?? '')) {
          out.statusCode = 403;
          out.end('Development pairing only answers this machine.\n');
          return;
        }
        issueLink(ownerSocket, serverAddress).then(
          (link) => {
            out.statusCode = 303;
            out.setHeader('location', link);
            out.end();
          },
          (error: unknown) => {
            out.statusCode = 502;
            out.setHeader('content-type', 'text/plain; charset=utf-8');
            out.end(
              `Could not pair this browser: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          },
        );
      });
    },
  };
}

function issueLink(ownerSocket: string, serverAddress: string) {
  const body = JSON.stringify({
    labels: ['Development browser'],
    addresses: [serverAddress],
  });
  return new Promise<string>((resolve, reject) => {
    const asked = request(
      {
        socketPath: ownerSocket,
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
          const [grant] = Schema.decodeUnknownSync(
            Schema.fromJsonString(issuePairingResponseSchema),
          )(text).grants;
          if (grant === undefined) {
            reject(new Error('the owner issued no grant'));
            return;
          }
          resolve(
            pairingLink({
              addresses: [''],
              code: grant.link.code,
              environmentId: grant.link.environmentId,
            }),
          );
        });
      },
    );
    asked.on('error', reject);
    asked.end(body);
  });
}
