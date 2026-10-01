import { describe, expect, it } from 'vitest';
import { developmentWeb } from './development-web.ts';

describe('developmentWeb', () => {
  it('serves the unpackaged app from the loopback Vite server it was given', () => {
    expect(developmentWeb(false, 'http://127.0.0.1:5199')).toBe(
      'http://127.0.0.1:5199',
    );
  });

  it('serves the unpackaged app its built web when no Vite server was given', () => {
    expect(developmentWeb(false, undefined)).toBeUndefined();
  });

  it.each(['http://127.0.0.1:5199', 'https://example.com', 'nonsense'])(
    'ignores a Vite server given to the installed app: %s',
    (value) => {
      expect(developmentWeb(true, value)).toBeUndefined();
    },
  );

  it.each([
    'https://127.0.0.1:5199',
    'http://example.com:5199',
    'http://192.168.1.2:5199',
    'http://owner:secret@127.0.0.1:5199',
    'http://127.0.0.1:5199/app',
    'http://127.0.0.1:5199/?mode=desktop',
    'file:///tmp/web',
    'not an address',
    true,
  ])(
    'refuses a Vite server that is not a loopback http origin: %s',
    (value) => {
      expect(() => developmentWeb(false, value)).toThrow(
        '--web-dev-server must be the http origin of a loopback Vite server',
      );
    },
  );
});
