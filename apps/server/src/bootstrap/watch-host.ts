import type { AsyncSubscription, Options } from '@parcel/watcher';
import { createInterface } from 'node:readline';
import {
  decodeWatchHostRequest,
  type WatchHostMessage,
  type WatchHostRequest,
} from '../adapters/events/watch-host-protocol.ts';

const parcelWatcher = await import('@parcel/watcher');
const subscriptions = new Map<number, AsyncSubscription>();
const turns = new Map<number, Promise<void>>();

function send(message: WatchHostMessage): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function options(ignore: readonly string[]): Options {
  return process.platform === 'linux'
    ? { backend: 'inotify', ignore: [...ignore] }
    : { ignore: [...ignore] };
}

async function release(subscription: number): Promise<void> {
  const current = subscriptions.get(subscription);
  subscriptions.delete(subscription);
  await current?.unsubscribe();
}

async function watch(
  request: Extract<WatchHostRequest, { kind: 'subscribe' }>,
): Promise<void> {
  await release(request.subscription);
  subscriptions.set(
    request.subscription,
    await parcelWatcher.subscribe(
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
    ),
  );
}

function inTurn(subscription: number, work: () => Promise<void>) {
  const done = (turns.get(subscription) ?? Promise.resolve()).then(work, work);
  const settled = done.then(
    () => undefined,
    () => undefined,
  );
  turns.set(subscription, settled);
  void settled.then(() => {
    if (turns.get(subscription) === settled) turns.delete(subscription);
  });
  return done;
}

function handle(request: WatchHostRequest): Promise<void> {
  if (request.kind === 'ping') return Promise.resolve();
  if (request.kind === 'subscribe')
    return inTurn(request.subscription, () => watch(request));
  return inTurn(request.subscription, () => release(request.subscription));
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
