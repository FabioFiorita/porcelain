export type DocumentLeaveGuard = (leave: () => void) => void;

export function leaveDocuments(
  guards: readonly DocumentLeaveGuard[],
  leave: () => void,
): void {
  const next = (index: number): void => {
    const guard = guards[index];
    if (guard) guard(() => next(index + 1));
    else leave();
  };
  next(0);
}
