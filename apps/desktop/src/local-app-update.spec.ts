import { describe, expect, it } from 'vitest';
import { LocalAppUpdate } from './local-app-update.ts';

describe('LocalAppUpdate', () => {
  it('reports no available release and publishes checking then idle', async () => {
    const states: ReturnType<LocalAppUpdate['read']>[] = [];
    const update = new LocalAppUpdate((state) => states.push(state));
    expect(update.read()).toEqual({ status: 'idle' });
    expect(await update.check()).toEqual({ available: null });
    expect(states).toEqual([{ status: 'checking' }, { status: 'idle' }]);
    expect(update.read()).toEqual({ status: 'idle' });
  });
  it('rejects installation and publishes an error when no release feed exists', async () => {
    const states: ReturnType<LocalAppUpdate['read']>[] = [];
    const update = new LocalAppUpdate((state) => states.push(state));
    await expect(update.install()).rejects.toThrow(
      'unavailable for this local build',
    );
    expect(states).toEqual([
      {
        status: 'error',
        message: 'App updates are unavailable for this local build',
      },
    ]);
    expect(update.read()).toEqual(states[0]);
  });
  it('allows a later check to clear a failed install state', async () => {
    const update = new LocalAppUpdate(() => undefined);
    await expect(update.install()).rejects.toThrow();
    expect(await update.check()).toEqual({ available: null });
    expect(update.read()).toEqual({ status: 'idle' });
  });
});
