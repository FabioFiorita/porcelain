import { Profiler, type ReactNode } from 'react';

const enabled = __DEV__ && process.env.EXPO_PUBLIC_PORCELAIN_PERF === '1';

type Landmark =
  | 'worktrees-first-row'
  | 'changes-first-file'
  | 'all-changes-first-heading';
type Screen = 'worktrees' | 'changes' | 'all-changes';
const seen = new Set<Landmark>();

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
  if (!enabled || seen.has(landmark)) return undefined;
  return () => {
    if (seen.has(landmark)) return;
    seen.add(landmark);
    log(landmark);
  };
}

export function startMobileNavigation(screen: Exclude<Screen, 'worktrees'>) {
  if (!enabled) return;
  seen.delete(
    screen === 'changes' ? 'changes-first-file' : 'all-changes-first-heading',
  );
  log(`${screen}-open`);
}

export function profileMobileScreen(screen: Screen, view: ReactNode) {
  return enabled ? (
    <Profiler id={screen} onRender={(id) => log(`${id}-commit`)}>
      {view}
    </Profiler>
  ) : (
    view
  );
}
