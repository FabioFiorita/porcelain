import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '../models/remote-access.ts';

export interface RouteListenerRunner {
  listen(input: RouteAddresses, signal?: AbortSignal): Promise<ListenOutcome>;
  close(input: RouteKey): Promise<void>;
}
