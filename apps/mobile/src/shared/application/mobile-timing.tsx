import { Profiler, type ReactNode } from 'react';
import { phoneTimingSupported } from './mobile-timing-device';
import {
  mobileTimingMarks,
  type MobileTimingDestination,
  type MobileTimingLandmark,
} from '../rules/mobile-timing';

const enabled =
  __DEV__ &&
  process.env.EXPO_PUBLIC_PORCELAIN_PERF === '1' &&
  phoneTimingSupported;

const clock = performance as Performance & {
  rnStartupTiming?: { startTime?: number | null };
};
const nativeStart = enabled
  ? (clock.rnStartupTiming?.startTime ?? undefined)
  : undefined;
const origin = enabled ? (nativeStart ?? clock.now()) : 0;
const nativeLog = enabled
  ? (
      globalThis as typeof globalThis & {
        nativeLoggingHook?: (message: string, level: number) => void;
      }
    ).nativeLoggingHook
  : undefined;

function log(name: string) {
  const message = `porcelain-perf ${name} ${Math.round(clock.now() - origin)}`;
  if (nativeLog) nativeLog(message, 1);
  else console.info(message);
}

if (enabled) log(nativeStart === undefined ? 'clock-js' : 'clock-rn');
const marks = enabled ? mobileTimingMarks(log) : undefined;

export function mobileLayout(landmark: MobileTimingLandmark) {
  return marks?.layout(landmark);
}

export function mobileWorktreeLayout(saved: boolean) {
  return marks?.worktreeLayout(saved);
}

export function startMobileNavigation(screen: MobileTimingDestination) {
  marks?.open(screen);
}

export function profileMobileScreen(
  screen: 'worktrees' | MobileTimingDestination,
  view: ReactNode,
) {
  return enabled ? (
    <Profiler id={screen} onRender={(id) => log(`${id}-commit`)}>
      {view}
    </Profiler>
  ) : (
    view
  );
}
