import { expect } from 'vite-plus/test';

export function withoutRandomUUID(
  onTestFinished: (restore: () => void) => void,
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Crypto.prototype,
    'randomUUID',
  );
  Reflect.deleteProperty(Crypto.prototype, 'randomUUID');
  onTestFinished(() => {
    if (descriptor)
      Object.defineProperty(Crypto.prototype, 'randomUUID', descriptor);
  });
  expect(typeof globalThis.crypto.randomUUID).toBe('undefined');
}
