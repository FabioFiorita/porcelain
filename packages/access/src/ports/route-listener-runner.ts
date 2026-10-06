import { Context } from 'effect';
import type { Effect } from 'effect';
import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '../models/remote-access.ts';

export interface RouteListenerRunner {
  listen(input: RouteAddresses): Effect.Effect<ListenOutcome>;
  close(input: RouteKey): Effect.Effect<void>;
}

export const RouteListenerRunner = Context.Service<
  '@porcelain/access/RouteListenerRunner',
  RouteListenerRunner
>('@porcelain/access/RouteListenerRunner');
