import type { ServiceUpdateAuthority } from '../models/authorize-service-update.ts';
import type {
  ServiceUpdateRefusal,
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '../models/service-update.ts';

export function serviceUpdateRefusal(
  state: ServiceUpdateState,
  target: ServiceUpdateTarget,
  authority: ServiceUpdateAuthority,
): ServiceUpdateRefusal | undefined {
  if (!authority.canUpdate) return { kind: 'untrusted' };
  if (!state.managed) return { kind: 'unmanaged' };
  if (state.running) return { kind: 'running' };
  if (!state.available || state.latest !== target.version)
    return { kind: 'not-offered' };
  return undefined;
}
