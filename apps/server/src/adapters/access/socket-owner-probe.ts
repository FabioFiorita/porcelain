import { Effect, Schema, Result } from 'effect';
import { request } from 'node:http';
import { constants } from 'node:http2';
import { ownerStatusSchema } from '@porcelain/kernel/models';
import type {
  OwnerProbe,
  OwnerProbeRequest,
  OwnerProbeResult,
} from '../../ports/owner-probe.ts';
type Answer =
  | { kind: 'answered'; status: number; body: string }
  | { kind: 'timed-out' }
  | { kind: 'failed'; error: unknown };
const ask = Effect.fn('SocketOwnerProbe.ask')((input: OwnerProbeRequest) =>
  Effect.callback<Answer>((resume) => {
    const resolve = (answer: Answer) => resume(Effect.succeed(answer));
    const reject = (cause: unknown) =>
      resolve({ kind: 'failed', error: cause });
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
    return Effect.sync(() => {
      outgoing.destroy();
    });
  }),
);
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
  readonly probe = Effect.fn('SocketOwnerProbe.probe')(function* (
    input: OwnerProbeRequest,
  ): Effect.fn.Return<OwnerProbeResult> {
    const answer = yield* ask(input);
    if (answer.kind === 'failed') {
      const error = answer.error;
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
    const status = Schema.decodeUnknownResult(ownerStatusSchema)(
      parsed(answer.body),
    );
    return Result.isSuccess(status)
      ? {
          kind: 'running',
          status: status.success,
        }
      : {
          kind: 'unreadable',
          reason: 'the owner socket answered something unrecognizable',
        };
  });
}
