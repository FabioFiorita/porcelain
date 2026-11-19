import { readFile } from 'node:fs/promises';
import * as Schema from 'effect/Schema';
import type { BrowserContext, Page } from '@playwright/test';

declare const window: EventTarget;

const historyKey = 'porcelain.connection-history';

export async function connectionHistoryAt(page: Page) {
  const open = () =>
    page
      .getByRole('button', { name: 'Connection history', exact: true })
      .click();
  await page.goto('/settings/computers/this-computer');
  await open();
  return open;
}

export function savedHistory(page: Page) {
  return page.evaluate(
    (key) =>
      Object.keys(localStorage)
        .filter((name) => name === key || name.startsWith(`${key}:`))
        .map((name) => localStorage.getItem(name))
        .join('\n'),
    historyKey,
  );
}

export function emitNetworkChange(
  page: Page,
  ...events: ('online' | 'offline')[]
) {
  return page.evaluate((events) => {
    for (const event of events) window.dispatchEvent(new Event(event));
  }, events);
}

export function withoutWebLocks(context: BrowserContext) {
  return context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
  });
}

export async function failHistoryWrites(page: Page) {
  const failure = await page.evaluateHandle((historyKey) => {
    const property = Object.getOwnPropertyDescriptor(
      Storage.prototype,
      'setItem',
    );
    const setItem: unknown = property?.value;
    if (!property || typeof setItem !== 'function')
      throw new Error('Storage.setItem is unavailable.');

    let attempts = 0;
    Storage.prototype.setItem = function (key, value) {
      if (
        this === localStorage &&
        (key === historyKey || key.startsWith(`${historyKey}:`))
      ) {
        attempts += 1;
        throw new DOMException('History storage is full', 'QuotaExceededError');
      }
      Reflect.apply(setItem, this, [key, value]);
    };
    return {
      attempts: () => attempts,
      restore: () =>
        Object.defineProperty(Storage.prototype, 'setItem', property),
    };
  }, historyKey);
  return {
    attempts: () => failure.evaluate((state) => state.attempts()),
    restore: () =>
      failure.evaluate((state) => {
        state.restore();
      }),
  };
}

export function historySnapshotCount(page: Page) {
  return page.evaluate(
    (key) =>
      Object.keys(localStorage).filter((name) => name.startsWith(`${key}:`))
        .length,
    historyKey,
  );
}

const decodeExport = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({
        diagnostic: Schema.Struct({ at: Schema.Int, event: Schema.String }),
      }),
    ),
  ),
);

export async function exportedHistory(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Export history', { exact: true }).click(),
  ]);
  return decodeExport(await readFile(await download.path(), 'utf8')).map(
    ({ diagnostic }) => diagnostic,
  );
}
