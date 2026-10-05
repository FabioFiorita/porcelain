import { Context } from 'effect';
import type { RedeemLiveTicketOptions as RedeemLiveTicketOptionsShape } from '../models/redeem-live-ticket.ts';
export const RedeemLiveTicketOptions = Context.Service<
  '@porcelain/access/RedeemLiveTicketOptions',
  RedeemLiveTicketOptionsShape
>('@porcelain/access/RedeemLiveTicketOptions');
