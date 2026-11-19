export type RequestedRead = 'idle' | 'requested' | 'reading' | 'failed';

export function requestedRead(
  state: RequestedRead,
  read: { waiting: boolean; failed: boolean },
): RequestedRead {
  switch (state) {
    case 'requested':
      return read.waiting ? 'reading' : 'requested';
    case 'reading':
      if (read.waiting) return 'reading';
      return read.failed ? 'failed' : 'idle';
    case 'failed':
      return read.waiting || read.failed ? 'failed' : 'idle';
    case 'idle':
      return 'idle';
  }
}
