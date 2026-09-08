import { describe, expect, it } from 'vitest';
import { readStartupSettings } from './startup-settings.ts';

const environment = {
  PORCELAIN_DATA_DIRECTORY: '/disposable/state',
  PORCELAIN_TOKEN: 'fixture-token-with-at-least-32-characters',
  PORCELAIN_PORT: '0',
};

describe('Documentation startup setting', () => {
  it.each([
    ['1', true],
    ['0', false],
    [undefined, undefined],
  ] as const)(
    'maps %s to explicit documentation setting %s',
    (value, expected) => {
      expect(
        readStartupSettings({
          ...environment,
          PORCELAIN_API_DOCUMENTATION: value,
        }).apiDocumentation,
      ).toBe(expected);
    },
  );
  it('rejects ambiguous values instead of accidentally exposing documentation', () => {
    expect(() =>
      readStartupSettings({
        ...environment,
        PORCELAIN_API_DOCUMENTATION: 'false',
      }),
    ).toThrow();
  });
});
