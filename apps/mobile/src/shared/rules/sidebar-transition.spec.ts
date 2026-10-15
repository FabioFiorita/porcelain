import { expect, it } from 'vitest';
import { transitionSidebar } from './sidebar-transition';

function motion() {
  let width = 256;
  let pending: number | undefined;
  const starts: number[] = [];
  return {
    stop: () => {
      pending = undefined;
    },
    settle: (target: number) => {
      width = target;
    },
    animate: (target: number) => {
      starts.push(width);
      pending = target;
    },
    advance: (progress: number) => {
      if (pending !== undefined) width += (pending - width) * progress;
    },
    read: () => ({ width, pending, starts }),
  };
}

it('closes and opens through intermediate widths instead of snapping the document edge', () => {
  const driver = motion();
  transitionSidebar(driver, false, 256, false);
  driver.advance(0.5);
  expect(driver.read().width).toBe(128);
  driver.advance(1);
  expect(driver.read().width).toBe(0);
  transitionSidebar(driver, true, 256, false);
  driver.advance(0.5);
  expect(driver.read().width).toBe(128);
  driver.advance(1);
  expect(driver.read().width).toBe(256);
});

it('reverses from the current position and settles at the last rapid toggle', () => {
  const driver = motion();
  transitionSidebar(driver, false, 256, false);
  driver.advance(0.5);
  transitionSidebar(driver, true, 256, false);
  expect(driver.read().width).toBe(128);
  driver.advance(0.5);
  expect(driver.read().width).toBe(192);
  for (const visible of [false, true, false, true, false])
    transitionSidebar(driver, visible, 256, false);
  expect(driver.read().starts).toEqual([256, 128, 192, 192, 192, 192, 192]);
  driver.advance(1);
  expect(driver.read().width).toBe(0);
});

it('uses the new sidebar width after resizing, including while a transition is interrupted', () => {
  const driver = motion();
  transitionSidebar(driver, false, 256, false);
  driver.advance(0.5);
  transitionSidebar(driver, true, 192, false);
  expect(driver.read().width).toBe(128);
  driver.advance(0.5);
  expect(driver.read().width).toBe(160);
  driver.advance(1);
  expect(driver.read().width).toBe(192);
  transitionSidebar(driver, false, 192, false);
  transitionSidebar(driver, false, 256, false);
  driver.advance(1);
  expect(driver.read().width).toBe(0);
});

it('cancels motion immediately when Reduce Motion changes and leaves no old animation to complete', () => {
  const driver = motion();
  transitionSidebar(driver, false, 256, false);
  driver.advance(0.5);
  transitionSidebar(driver, true, 256, true);
  expect(driver.read()).toEqual({
    width: 256,
    pending: undefined,
    starts: [256],
  });
  driver.advance(1);
  expect(driver.read().width).toBe(256);
  transitionSidebar(driver, false, 192, true);
  expect(driver.read().width).toBe(0);
  transitionSidebar(driver, true, 192, true);
  expect(driver.read().width).toBe(192);
});
