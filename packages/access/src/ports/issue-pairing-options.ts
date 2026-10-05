import { Context } from 'effect';
import type { IssuePairingOptions as IssuePairingOptionsShape } from '../models/issue-pairing.ts';
export const IssuePairingOptions = Context.Service<
  '@porcelain/access/IssuePairingOptions',
  IssuePairingOptionsShape
>('@porcelain/access/IssuePairingOptions');
