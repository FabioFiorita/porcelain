import { controlledPromise } from './promise.ts';
import type { Transport } from '../../src/shared/api/transport.ts';
export function holdFirstRead() {
  const held = controlledPromise<Response>();
  const started = controlledPromise<void>();
  let reads = 0;
  return {
    held,
    started,
    readCount: () => reads,
    read: () => {
      if (++reads === 1) {
        started.resolve();
        return held.promise;
      }
      return Promise.resolve(
        Response.json({ message: 'Refresh unavailable' }, { status: 503 }),
      );
    },
  };
}
export function abortingTransport() {
  const started = controlledPromise<AbortSignal>();
  const transport: Transport = (_path, init) => {
    const signal = init!.signal!;
    started.resolve(signal);
    return new Promise<Response>((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      }),
    );
  };
  return { started, transport };
}
