import { LIMITS, type Limits } from './limits.ts';

export type CliSettings = { limits: Limits };

export function readCliSettings(): CliSettings {
  return { limits: LIMITS };
}
