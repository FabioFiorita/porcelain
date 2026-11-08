import { randomUUID } from 'node:crypto';
import { Option, Schema } from 'effect';
import type { Page } from '@playwright/test';

declare const parent: { postMessage(data: unknown, origin: string): void };
declare function addEventListener(
  type: 'message',
  listener: (event: { data: unknown }) => void,
): void;
declare function addEventListener(
  type: 'load',
  listener: (event: { readonly timeStamp: number }) => void,
): void;
declare const document: {
  readonly readyState: string;
  querySelector(selector: 'h1'): unknown;
  hasFocus(): boolean;
  addEventListener(
    type: 'DOMContentLoaded',
    listener: (event: { readonly timeStamp: number }) => void,
  ): void;
  addEventListener(
    type: 'click' | 'pointerover' | 'pointermove',
    listener: (event: {
      isTrusted: boolean;
      target: { getAttribute?(name: string): string | null } | null;
    }) => void,
    capture?: boolean,
  ): void;
};

export async function watchSummaryActivations(page: Page) {
  const marker = randomUUID();
  const binding = `porcelainSummaryDocument${marker.replaceAll('-', '')}`;
  const documentSchema = Schema.Struct({
    phase: Schema.Literals(['init', 'DOMContentLoaded', 'load']),
    eventTime: Schema.optional(Schema.Number),
    readyState: Schema.Literals(['loading', 'interactive', 'complete']),
    heading: Schema.Boolean,
  });
  let sequence = 0;
  const nextEvent = () => ++sequence;
  const documents: (typeof documentSchema.Type & { received: number })[] = [];
  await page.exposeBinding(binding, ({ frame }, value: unknown) => {
    if (frame !== page.mainFrame()) return;
    const decoded = Schema.decodeUnknownOption(documentSchema)(value);
    if (Option.isNone(decoded)) return;
    const { phase, eventTime, readyState, heading } = decoded.value;
    documents.push({
      phase,
      eventTime,
      readyState,
      heading,
      received: nextEvent(),
    });
  });
  await page.evaluate(
    ({ marker, binding }) => {
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
          const document: unknown = Reflect.get(data, 'document');
          const receive: unknown = Reflect.get(globalThis, binding);
          if (document !== undefined && typeof receive === 'function')
            void Reflect.apply(receive, globalThis, [document]);
        }
      });
    },
    { marker, binding },
  );
  const observe = (marker: string) => {
    const announce = (phase: string, eventTime?: number) =>
      parent.postMessage(
        {
          source: marker,
          document: {
            phase,
            eventTime,
            readyState: document.readyState,
            heading: document.querySelector('h1') !== null,
          },
        },
        '*',
      );
    announce('init');
    document.addEventListener('DOMContentLoaded', (event) =>
      announce('DOMContentLoaded', event.timeStamp),
    );
    addEventListener('load', (event) => announce('load', event.timeStamp));
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
  return { documents: () => [...documents], nextEvent };
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

export async function resetSummaryActivations(page: Page) {
  await page.evaluate(() => {
    const activations: unknown = Reflect.get(
      globalThis,
      'porcelainSummaryActivations',
    );
    if (!Array.isArray(activations))
      throw new Error('Summary observation has not started');
    activations.length = 0;
    Reflect.set(globalThis, 'porcelainSummaryPointer', undefined);
  });
}
