import { Result, Schema, type Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import type { TunnelProbe } from '@porcelain/access/ports';
import { PublicAccessApi } from '@porcelain/contracts/access';
import { HttpApiClient } from 'effect/http-api';

export class HttpTunnelProbe implements TunnelProbe {
  private readonly timeoutMs: number;

  constructor(options: { timeoutMs: number }) {
    this.timeoutMs = options.timeoutMs;
  }

  probe(input: TunnelTarget): Effect.Effect<TunnelAnswer> {
    return nativeOperation((signal) => this.probeNative(input, signal));
  }

  private async probeNative(
    input: TunnelTarget,
    signal?: AbortSignal,
  ): Promise<TunnelAnswer> {
    let response: Response;
    try {
      response = await fetch(
        new URL(
          HttpApiClient.urlBuilder(PublicAccessApi).publicAccess.readHealth(),
          input.origin,
        ),
        {
          method:
            PublicAccessApi.groups.publicAccess.endpoints.readHealth.method,
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.any([
            ...(signal ? [signal] : []),
            AbortSignal.timeout(this.timeoutMs),
          ]),
        },
      );
    } catch {
      signal?.throwIfAborted();
      return { kind: 'unreachable' };
    }
    if (response.status >= 500) return { kind: 'unreachable' };
    if (!response.ok) return { kind: 'foreign' };
    const health = Schema.decodeUnknownResult(readHealthResponseSchema)(
      await response.json().catch(() => undefined),
    );
    return Result.isSuccess(health)
      ? { kind: 'answered', environmentId: health.success.environmentId }
      : { kind: 'foreign' };
  }
}
