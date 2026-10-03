import { request } from 'node:http';
import { constants } from 'node:http2';
import type { OwnerStatus } from '@porcelain/kernel/models';
import { z } from 'zod';
import type {
  OwnerProbe,
  OwnerProbeRequest,
  OwnerProbeResult,
} from '../../ports/owner-probe.ts';

const ownerStatusSchema: z.ZodType<OwnerStatus> = z.object({
  address: z.string(),
  dataDirectory: z.string(),
  pid: z.number().int(),
});

type Answer =
  | { kind: 'answered'; status: number; body: string }
  | { kind: 'timed-out' };

function ask(input: OwnerProbeRequest): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        socketPath: input.socketPath,
        path: '/status',
        method: 'GET',
        timeout: input.timeoutMs,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            kind: 'answered',
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    outgoing.on('timeout', () => {
      resolve({ kind: 'timed-out' });
      outgoing.destroy();
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

function absent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ECONNREFUSED')
  );
}

function parsed(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export class SocketOwnerProbe implements OwnerProbe {
  async probe(input: OwnerProbeRequest): Promise<OwnerProbeResult> {
    let answer: Answer;
    try {
      answer = await ask(input);
    } catch (error) {
      return absent(error)
        ? { kind: 'absent' }
        : {
            kind: 'unreadable',
            reason: error instanceof Error ? error.message : String(error),
          };
    }
    if (answer.kind === 'timed-out')
      return {
        kind: 'unreadable',
        reason: 'the owner socket did not answer in time',
      };
    if (answer.status !== constants.HTTP_STATUS_OK)
      return {
        kind: 'unreadable',
        reason: `the owner socket answered ${answer.status || 'nothing'}`,
      };
    const status = ownerStatusSchema.safeParse(parsed(answer.body));
    return status.success
      ? { kind: 'running', status: status.data }
      : {
          kind: 'unreadable',
          reason: 'the owner socket answered something unrecognizable',
        };
  }
}
