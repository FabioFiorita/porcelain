import { Context } from 'effect';
import type { RefundPairingAttemptOptions as RefundPairingAttemptOptionsShape } from '../models/refund-pairing-attempt.ts';
export const RefundPairingAttemptOptions = Context.Service<
  '@porcelain/access/RefundPairingAttemptOptions',
  RefundPairingAttemptOptionsShape
>('@porcelain/access/RefundPairingAttemptOptions');
