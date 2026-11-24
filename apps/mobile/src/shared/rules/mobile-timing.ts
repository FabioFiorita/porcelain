const navigationLandmarks = {
  changes: 'changes-first-file',
  'all-changes': 'all-changes-first-heading',
} as const;

export type MobileTimingDestination = keyof typeof navigationLandmarks;
export type MobileTimingLandmark =
  | 'worktrees-first-row'
  | 'worktrees-first-saved-row'
  | (typeof navigationLandmarks)[MobileTimingDestination];

export function mobileTimingMarks(log: (name: string) => void) {
  const pending = new Set<MobileTimingLandmark>([
    'worktrees-first-row',
    'worktrees-first-saved-row',
  ]);
  function layout(landmark: MobileTimingLandmark) {
    return () => {
      if (pending.delete(landmark)) log(landmark);
    };
  }
  return {
    layout,
    worktreeLayout(saved: boolean) {
      const name = saved ? 'worktrees-first-saved-row' : 'worktrees-first-row';
      return { name, onLayout: layout(name) };
    },
    open(screen: MobileTimingDestination) {
      pending.add(navigationLandmarks[screen]);
      log(`${screen}-open`);
    },
  };
}
