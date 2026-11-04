import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

declare const parent: { postMessage(data: unknown, origin: string): void };
declare function addEventListener(
  type: 'message',
  listener: (event: { data: unknown }) => void,
): void;
declare const document: {
  hasFocus(): boolean;
  addEventListener(
    type: 'click' | 'pointerover' | 'pointermove',
    listener: (event: {
      isTrusted: boolean;
      target: { getAttribute?(name: string): string | null } | null;
    }) => void,
    capture?: boolean,
  ): void;
};

export async function watchSummaryActivations(
  page: Page,
  frame: ReturnType<Page['frames']>[number],
) {
  const marker = randomUUID();
  await page.evaluate((marker) => {
    const activations: unknown[] = [];
    Reflect.set(globalThis, 'porcelainSummaryActivations', activations);
    Reflect.set(globalThis, 'porcelainSummaryPointer', undefined);
    addEventListener('message', (event) => {
      const data = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        Reflect.get(data, 'source') === marker
      ) {
        const activation: unknown = Reflect.get(data, 'activation');
        if (activation !== undefined) activations.push(activation);
        const pointer: unknown = Reflect.get(data, 'pointer');
        if (pointer !== undefined)
          Reflect.set(globalThis, 'porcelainSummaryPointer', pointer);
      }
    });
  }, marker);
  const observe = (marker: string) => {
    for (const type of ['pointerover', 'pointermove'] as const)
      document.addEventListener(
        type,
        (event) => {
          parent.postMessage(
            {
              source: marker,
              pointer: {
                trusted: event.isTrusted,
                href: event.target?.getAttribute?.('href'),
              },
            },
            '*',
          );
        },
        true,
      );
    document.addEventListener(
      'click',
      (event) => {
        parent.postMessage(
          {
            source: marker,
            activation: {
              trusted: event.isTrusted,
              href: event.target?.getAttribute?.('href'),
              focused: document.hasFocus(),
            },
          },
          '*',
        );
      },
      true,
    );
  };
  await page.addInitScript(observe, marker);
  await frame.evaluate(observe, marker);
}

export function summaryActivations(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const activations: unknown = Reflect.get(
      globalThis,
      'porcelainSummaryActivations',
    );
    return activations;
  });
}
