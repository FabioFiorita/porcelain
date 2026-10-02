import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WindowState } from './window-state.ts';

const first = {
  bounds: { x: 0, y: 0, width: 900, height: 700 },
  maximized: false,
};
const second = {
  bounds: { x: 40, y: 30, width: 1000, height: 760 },
  maximized: false,
};
const third = {
  bounds: { x: 40, y: 30, width: 1000, height: 760 },
  maximized: true,
};

describe('WindowState', () => {
  let profile = '';
  beforeEach(async () => {
    profile = await mkdtemp(join(tmpdir(), 'porcelain-window-state-'));
  });
  afterEach(async () => {
    await rm(profile, { recursive: true, force: true });
  });

  it('restores nothing for a fresh profile until a state is saved', async () => {
    const state = new WindowState(profile, 60_000);
    expect(state.read()).toBeUndefined();
    state.schedule(first);
    await state.flush();
    expect(state.read()).toEqual({
      bounds: { x: 0, y: 0, width: 900, height: 700 },
      maximized: false,
    });
  });

  it('writes nothing while a window keeps moving, then saves only its last state', async () => {
    const state = new WindowState(profile, 50);
    state.schedule(first);
    state.schedule(second);
    expect(await readdir(profile)).toEqual([]);
    await expect
      .poll(() => new WindowState(profile, 50).read())
      .toEqual(second);
    expect(await readdir(profile)).toEqual(['window.json']);
  });

  it('saves the pending state at once when asked to flush, as when the window closes', async () => {
    const state = new WindowState(profile, 60_000);
    state.schedule(first);
    await state.flush();
    expect(new WindowState(profile, 10).read()).toEqual(first);
  });

  it('keeps the latest state when an earlier save is still being written', async () => {
    const state = new WindowState(profile, 60_000);
    state.schedule(first);
    const earlier = state.flush();
    state.schedule(second);
    state.schedule(third);
    await Promise.all([earlier, state.flush()]);
    expect(new WindowState(profile, 10).read()).toEqual(third);
  });
});
