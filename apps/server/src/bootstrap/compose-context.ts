import type { Clock, IdSource } from '@porcelain/kernel/ports';
import type { ServerSettings } from '../config/server-settings.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { Logger } from '../ports/logger.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

export type ComposeContext = {
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  settings: ServerSettings;
  clock: Clock;
  ids: IdSource;
  logger: Logger;
};
