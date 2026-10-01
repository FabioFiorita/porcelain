import { describe, expect, it } from 'vitest';
import { liveAddress, liveSocketHeaders } from './live-socket.ts';

const server = {
  address: 'http://127.0.0.1:4321',
  credential: 'test-only-desktop-credential',
};
const mainFrame = { name: 'main' };
const app = { contentsId: 7, mainFrame, url: 'porcelain://app/project' };
const socket = {
  url: 'ws://127.0.0.1:4321/api/live',
  contentsId: 7,
  frame: mainFrame,
  initiatorOrigin: 'porcelain://app',
  headers: { 'Sec-WebSocket-Version': '13' },
};

describe('liveAddress', () => {
  it('opens the live socket of an HTTP server over ws', () => {
    expect(liveAddress('http://127.0.0.1:4321')).toBe(
      'ws://127.0.0.1:4321/api/live',
    );
  });

  it('opens the live socket of an HTTPS server over wss', () => {
    expect(liveAddress('https://computer.example.invalid')).toBe(
      'wss://computer.example.invalid/api/live',
    );
  });
});

describe('liveSocketHeaders', () => {
  it('adds the app credential and the server origin to the app main frame socket', () => {
    expect(liveSocketHeaders(socket, app, server)).toEqual({
      'Sec-WebSocket-Version': '13',
      Authorization: 'Bearer test-only-desktop-credential',
      Origin: 'http://127.0.0.1:4321',
    });
  });

  it('refuses while the app window is closed', () => {
    expect(liveSocketHeaders(socket, undefined, server)).toBeUndefined();
  });

  it('refuses a socket another window opens', () => {
    expect(
      liveSocketHeaders({ ...socket, contentsId: 8 }, app, server),
    ).toBeUndefined();
  });

  it.each([{ name: 'summary' }, null, undefined])(
    'refuses a socket a frame other than the app main frame opens: %s',
    (frame) => {
      expect(liveSocketHeaders({ ...socket, frame }, app, server)).toBe(
        undefined,
      );
    },
  );

  it.each([undefined, 'null', 'http://127.0.0.1:4321', 'https://evil.example'])(
    'refuses a socket another document initiates: %s',
    (initiatorOrigin) => {
      expect(
        liveSocketHeaders({ ...socket, initiatorOrigin }, app, server),
      ).toBeUndefined();
    },
  );

  it.each([
    'https://evil.example/',
    'porcelain://app/remote-review-summaries/token?computer=http://evil.example',
  ])('refuses once the app window shows another document: %s', (url) => {
    expect(liveSocketHeaders(socket, { ...app, url }, server)).toBeUndefined();
  });

  it.each([
    'ws://127.0.0.1:4322/api/live',
    'ws://127.0.0.1:4321/api/live?ticket=x',
    'ws://127.0.0.1:4321/api/other',
    'wss://127.0.0.1:4321/api/live',
  ])('refuses any socket but the local live address: %s', (url) => {
    expect(liveSocketHeaders({ ...socket, url }, app, server)).toBeUndefined();
  });
});
