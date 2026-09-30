import type { RouteState } from '../models/remote-access.ts';

export function tailnetNeedsCheck(state: RouteState): boolean {
  return (
    state.kind === 'off' ||
    state.kind === 'starting' ||
    (state.kind === 'failed' &&
      (state.reason === 'address-in-use' ||
        state.reason === 'address-unavailable'))
  );
}

export function tailnetTarget(address: string, port: number): string {
  return `http://${address}:${port}`;
}

export function tailnetOrigin(hostname: string): string {
  return `https://${hostname}`;
}
