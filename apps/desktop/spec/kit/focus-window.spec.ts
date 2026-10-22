import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { focusWindow } from './focus-window.ts';

describe('native window input readiness', () => {
  it.each([
    { name: 'already focused', initial: true, immediate: false },
    { name: 'synchronous native focus', initial: false, immediate: true },
    { name: 'pending native focus', initial: false, immediate: false },
  ])(
    'waits for $name before focusing web contents',
    async ({ initial, immediate }) => {
      const events = new EventEmitter();
      const calls: string[] = [];
      let nativeFocused = initial;
      const ready = () => {
        nativeFocused = true;
        calls.push('native focus');
        events.emit('focus');
      };
      const completed = focusWindow({
        app: {
          focus: () => {
            calls.push('activate app');
          },
        },
        BrowserWindow: {
          getAllWindows: () => [
            {
              isFocused: () => nativeFocused,
              once: (event, listener) => events.once(event, listener),
              focus: () => {
                calls.push('request window focus');
                if (immediate) ready();
              },
              webContents: {
                focus: () => {
                  calls.push('focus web contents');
                },
              },
            },
          ],
        },
      });
      await Promise.resolve();
      if (!initial && !immediate) {
        expect(calls).toEqual(['activate app', 'request window focus']);
        ready();
      }
      await completed;
      expect(calls).toEqual(
        initial
          ? ['activate app', 'request window focus', 'focus web contents']
          : [
              'activate app',
              'request window focus',
              'native focus',
              'focus web contents',
            ],
      );
      expect(events.listenerCount('focus')).toBe(0);
    },
  );

  it('fails before requesting input when no app window exists', async () => {
    const calls: string[] = [];
    await expect(
      focusWindow({
        app: {
          focus: () => {
            calls.push('activate app');
          },
        },
        BrowserWindow: { getAllWindows: () => [] },
      }),
    ).rejects.toThrow('The app window is missing');
    expect(calls).toEqual([]);
  });
});
