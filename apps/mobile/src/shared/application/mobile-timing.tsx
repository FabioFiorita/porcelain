import { Profiler, type ReactNode } from 'react';
import { phoneTimingSupported } from './mobile-timing-device';

const enabled =
  __DEV__ &&
  process.env.EXPO_PUBLIC_PORCELAIN_PERF === '1' &&
  phoneTimingSupported;

const navigationLandmarks = {
  changes: 'changes-first-file',
  'all-changes': 'all-changes-first-heading',
} as const;
type Destination = keyof typeof navigationLandmarks;
type Landmark =
  | 'worktrees-first-row'
  | (typeof navigationLandmarks)[Destination];
const pending = new Set<Landmark>(['worktrees-first-row']);

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

export function mobileLayout(landmark: Landmark) {
  if (!enabled) return undefined;
  return () => {
    if (!pending.delete(landmark)) return;
    log(landmark);
  };
}

export function startMobileNavigation(screen: Destination) {
  if (!enabled) return;
  pending.add(navigationLandmarks[screen]);
  log(`${screen}-open`);
}

export function profileMobileScreen(
  screen: 'worktrees' | Destination,
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
