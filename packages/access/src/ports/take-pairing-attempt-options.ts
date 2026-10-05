import { Context } from 'effect';
import type { TakePairingAttemptOptions as TakePairingAttemptOptionsShape } from '../models/take-pairing-attempt.ts';
export const TakePairingAttemptOptions = Context.Service<
  '@porcelain/access/TakePairingAttemptOptions',
  TakePairingAttemptOptionsShape
>('@porcelain/access/TakePairingAttemptOptions');
