import * as parcelWatcher from '@parcel/watcher';
import { createInterface } from 'node:readline';
import {
  decodeWatchHostRequest,
  type WatchHostMessage,
  type WatchHostRequest,
} from '../adapters/events/watch-host-protocol.ts';

const subscriptions = new Map<number, parcelWatcher.AsyncSubscription>();

function send(message: WatchHostMessage): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function options(ignore: readonly string[]): parcelWatcher.Options {
  return process.platform === 'linux'
    ? { backend: 'inotify', ignore: [...ignore] }
    : { ignore: [...ignore] };
}

async function handle(request: WatchHostRequest): Promise<void> {
  if (request.kind === 'ping') return;
  if (request.kind === 'subscribe') {
    await subscriptions.get(request.subscription)?.unsubscribe();
    subscriptions.delete(request.subscription);
    const subscription = await parcelWatcher.subscribe(
      request.directory,
      (error, events) =>
        send({
          kind: 'events',
          subscription: request.subscription,
          ...(error ? { failure: reason(error) } : {}),
          events: events.map((event) => ({
            path: event.path,
            type: event.type,
          })),
        }),
      options(request.ignore),
    );
    subscriptions.set(request.subscription, subscription);
    return;
  }
  const subscription = subscriptions.get(request.subscription);
  subscriptions.delete(request.subscription);
  await subscription?.unsubscribe();
}

createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })
  .on('line', (line) => {
    const request = decodeWatchHostRequest(line);
    if (request._tag === 'None') return;
    handle(request.value).then(
      () => send({ kind: 'answer', request: request.value.request }),
      (error: unknown) =>
        send({
          kind: 'answer',
          request: request.value.request,
          failure: reason(error),
        }),
    );
  })
  .on('close', () => process.exit(0));
