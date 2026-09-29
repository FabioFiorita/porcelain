import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import type { TunnelProbe } from '@porcelain/access/ports';
import { z } from 'zod';

const healthSchema = z.object({
  status: z.literal('ok'),
  environmentId: z.string(),
});

export class HttpTunnelProbe implements TunnelProbe {
  private readonly timeoutMs: number;

  constructor(options: { timeoutMs: number }) {
    this.timeoutMs = options.timeoutMs;
  }

  async probe(
    input: TunnelTarget,
    signal?: AbortSignal,
  ): Promise<TunnelAnswer> {
    let response: Response;
    try {
      response = await fetch(new URL('/api/health', input.origin), {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(this.timeoutMs),
        ]),
      });
    } catch {
      signal?.throwIfAborted();
      return { kind: 'unreachable' };
    }
    if (response.status >= 500) return { kind: 'unreachable' };
    if (!response.ok) return { kind: 'foreign' };
    const health = healthSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    return health.success
      ? { kind: 'answered', environmentId: health.data.environmentId }
      : { kind: 'foreign' };
  }
}
