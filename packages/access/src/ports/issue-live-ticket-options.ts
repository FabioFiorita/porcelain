import { Context } from 'effect';
import type { IssueLiveTicketOptions as IssueLiveTicketOptionsShape } from '../models/issue-live-ticket.ts';
export const IssueLiveTicketOptions = Context.Service<
  '@porcelain/access/IssueLiveTicketOptions',
  IssueLiveTicketOptionsShape
>('@porcelain/access/IssueLiveTicketOptions');
