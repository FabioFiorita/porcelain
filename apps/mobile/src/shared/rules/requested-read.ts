export type RequestedRead =
  | { readonly kind: 'idle' }
  | { readonly kind: 'requested'; readonly from: readonly unknown[] }
  | { readonly kind: 'reading' }
  | { readonly kind: 'failed' };

export const idleRead: RequestedRead = { kind: 'idle' };

export function requestRead(current: readonly unknown[]): RequestedRead {
  return { kind: 'requested', from: current };
}

export function requestedRead(
  state: RequestedRead,
  read: { waiting: boolean; failed: boolean; current: readonly unknown[] },
): RequestedRead {
  switch (state.kind) {
    case 'requested':
      if (read.waiting) return { kind: 'reading' };
      if (sameReads(state.from, read.current)) return state;
      return read.failed ? { kind: 'failed' } : idleRead;
    case 'reading':
      if (read.waiting) return state;
      return read.failed ? { kind: 'failed' } : idleRead;
    case 'failed':
      return read.waiting || read.failed ? state : idleRead;
    case 'idle':
      return state;
  }
}

function sameReads(left: readonly unknown[], right: readonly unknown[]) {
  return (
    left.length === right.length &&
    left.every((read, index) => read === right[index])
  );
}
