import { Deferred, Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { expect, test } from 'vite-plus/test';
import { notificationNotice, notifier, type NotifyEvent } from './notice';

function harness(platformShowsCopy: boolean) {
  const announced: string[] = [];
  const shown: Deferred.Deferred<void>[] = [];
  const notify = notifier({
    platformShowsCopy,
    announce: (title) => announced.push(title),
    shownFor: () =>
      Effect.gen(function* () {
        const elapsed = yield* Deferred.make<void>();
        shown.push(elapsed);
        yield* Deferred.await(elapsed);
      }),
  });
  const registry = AtomRegistry.make();
  registry.mount(notify);
  return {
    announced,
    shown,
    send: (event: NotifyEvent) => registry.set(notify, event),
    elapse: (index: number) =>
      Effect.runSync(Deferred.succeed(shown[index]!, undefined)),
    visible: () => registry.get(notificationNotice),
  };
}

test('a copy the platform confirms leaves the current notice to dismiss on time', async () => {
  const { send, elapse, visible, shown, announced } = harness(true);
  send({ kind: 'git', action: 'fetch' });
  await expect.poll(() => shown.length).toBe(1);
  expect(visible()).toBe('Fetched');
  send({ kind: 'copy', target: 'comments' });
  expect(visible()).toBe('Fetched');
  elapse(0);
  await expect.poll(visible).toBeNull();
  expect(announced).toEqual(['Fetched']);
});

test('a replaced notice does not dismiss the notice that replaced it', async () => {
  const { send, elapse, visible, shown, announced } = harness(false);
  send({ kind: 'git', action: 'fetch' });
  await expect.poll(() => shown.length).toBe(1);
  send({ kind: 'copy', target: 'comments' });
  await expect.poll(() => shown.length).toBe(2);
  expect(visible()).toBe('Copied comments');
  elapse(0);
  await expect(
    expect.poll(visible, { timeout: 200, interval: 20 }).toBeNull(),
  ).rejects.toThrow();
  expect(visible()).toBe('Copied comments');
  elapse(1);
  await expect.poll(visible).toBeNull();
  expect(announced).toEqual(['Fetched', 'Copied comments']);
});

test('a pull request notice names the pull request it changed', async () => {
  const { send, visible, shown, announced } = harness(true);
  send({ kind: 'pull-request', action: 'merged', number: 57 });
  await expect.poll(() => shown.length).toBe(1);
  expect(visible()).toBe('Merged #57');
  send({ kind: 'pull-request', action: 'commented', number: 57 });
  await expect.poll(() => shown.length).toBe(2);
  expect(announced).toEqual(['Merged #57', 'Commented on #57']);
});
