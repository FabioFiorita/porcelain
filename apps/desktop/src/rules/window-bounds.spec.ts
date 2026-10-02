import { describe, expect, it } from 'vitest';
import { restoreWindowBounds } from './window-bounds.ts';

describe('restoreWindowBounds', () => {
  const display = { x: 0, y: 0, width: 1440, height: 900 };
  const minimum = { width: 800, height: 600 };
  const state = {
    bounds: { x: 100, y: 50, width: 1000, height: 700 },
    maximized: true,
  };
  it('restores a window that fits on a connected display', () => {
    expect(restoreWindowBounds(state, [display], minimum)).toEqual(state);
  });
  it('does not restore onto a disconnected display', () => {
    const moved = { ...state, bounds: { ...state.bounds, x: 1600 } };
    expect(restoreWindowBounds(moved, [display], minimum)).toBeUndefined();
    expect(
      restoreWindowBounds(moved, [display, { ...display, x: 1440 }], minimum),
    ).toEqual({
      bounds: { x: 1600, y: 50, width: 1000, height: 700 },
      maximized: true,
    });
  });
  it('restores a window on a display to the left of the primary display', () => {
    const left = { ...display, x: -1440 };
    const stored = { ...state, bounds: { ...state.bounds, x: -1300 } };
    expect(restoreWindowBounds(stored, [display, left], minimum)).toEqual(
      stored,
    );
  });
  it('does not restore a window below the minimum size', () => {
    const narrow = { ...state, bounds: { ...state.bounds, width: 700 } };
    expect(restoreWindowBounds(narrow, [display], minimum)).toBeUndefined();
    expect(
      restoreWindowBounds(narrow, [display], { width: 700, height: 600 }),
    ).toEqual({
      bounds: { x: 100, y: 50, width: 700, height: 700 },
      maximized: true,
    });
  });
  it('lets a fresh profile use the default window', () => {
    expect(restoreWindowBounds(undefined, [display], minimum)).toBeUndefined();
    expect(restoreWindowBounds(state, [display], minimum)).toEqual({
      bounds: { x: 100, y: 50, width: 1000, height: 700 },
      maximized: true,
    });
  });
});
