import type { Page } from '@playwright/test';

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
  return page.evaluate((key) => localStorage.getItem(key) ?? '', historyKey);
}

export function emitNetworkChange(
  page: Page,
  ...events: ('online' | 'offline')[]
) {
  return page.evaluate((events) => {
    for (const event of events) window.dispatchEvent(new Event(event));
  }, events);
}

export async function holdHistoryWrite(page: Page) {
  const release = await page.evaluateHandle(
    (key) =>
      new Promise<() => void>((held) => {
        void navigator.locks.request(
          key,
          () => new Promise<void>((unlock) => held(unlock)),
        );
      }),
    historyKey,
  );
  return () => release.evaluate((unlock) => unlock());
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
      if (this === localStorage && key === historyKey) {
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
