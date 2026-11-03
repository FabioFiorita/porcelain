import { type Effect, Context } from 'effect';
import type { PushDelivery, PushEvent } from '@porcelain/access/models';

export interface NotifyDevicesUseCasePort {
  execute(event: PushEvent): Effect.Effect<PushDelivery>;
}

export const NotifyDevicesUseCasePort = Context.Service<
  '@porcelain/server/NotifyDevicesUseCasePort',
  NotifyDevicesUseCasePort
>('@porcelain/server/NotifyDevicesUseCasePort');
