import { LIMITS, type Limits } from './limits.ts';

type CliSettings = { limits: Limits };

export function readCliSettings(): CliSettings {
  return { limits: LIMITS };
}
