import type {
  ServiceUpdateRefusal,
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '../models/service-update.ts';

export function serviceUpdateRefusal(
  state: ServiceUpdateState,
  target: ServiceUpdateTarget,
): ServiceUpdateRefusal | undefined {
  if (!state.managed) return { kind: 'unmanaged' };
  if (state.running) return { kind: 'running' };
  if (!state.available || state.latest !== target.version)
    return { kind: 'not-offered' };
  return undefined;
}
