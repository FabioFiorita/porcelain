import { Context } from 'effect';
import type { RedeemPairingOptions as RedeemPairingOptionsShape } from '../models/redeem-pairing.ts';
export const RedeemPairingOptions = Context.Service<
  '@porcelain/access/RedeemPairingOptions',
  RedeemPairingOptionsShape
>('@porcelain/access/RedeemPairingOptions');
