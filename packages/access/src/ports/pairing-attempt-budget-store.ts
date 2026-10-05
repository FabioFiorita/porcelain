import { Context } from 'effect';
import type { PairingAttemptBudgets } from '../models/pairing-attempts.ts';
import type { PairingAttemptStore } from './pairing-attempt-store.ts';
export const PairingAttemptBudgetStore = Context.Service<
  '@porcelain/access/PairingAttemptBudgetStore',
  PairingAttemptBudgets<PairingAttemptStore>
>('@porcelain/access/PairingAttemptBudgetStore');
