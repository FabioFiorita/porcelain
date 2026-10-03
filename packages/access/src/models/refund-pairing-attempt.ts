import type {
  PairingAttemptBudgets,
  PairingAttemptLimits,
} from './pairing-attempts.ts';

export type RefundPairingAttemptInput = { peer: string; crossOrigin: boolean };

export type RefundPairingAttemptOptions =
  PairingAttemptBudgets<PairingAttemptLimits>;
