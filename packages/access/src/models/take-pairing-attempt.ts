import type {
  PairingAttemptBudgets,
  PairingAttemptLimits,
} from './pairing-attempts.ts';

export type TakePairingAttemptInput = { peer: string; crossOrigin: boolean };

export type TakePairingAttemptOptions =
  PairingAttemptBudgets<PairingAttemptLimits>;
