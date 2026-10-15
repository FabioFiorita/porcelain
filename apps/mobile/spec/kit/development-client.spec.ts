import { afterEach, beforeEach, expect, it } from 'vitest';
import { nativeFingerprint } from './development-client.ts';

let variant: string | undefined;
beforeEach(() => {
  variant = process.env.APP_VARIANT;
});
afterEach(() => {
  if (variant === undefined) Reflect.deleteProperty(process.env, 'APP_VARIANT');
  else process.env.APP_VARIANT = variant;
});

it.each(['preview', 'production'])(
  'refuses to cache a development client under %s native inputs',
  async (value) => {
    process.env.APP_VARIANT = value;
    await expect(nativeFingerprint(undefined, 'android')).rejects.toThrow(
      'Mobile verification only builds Porcelain Dev. Unset APP_VARIANT or set it to development.',
    );
  },
);
