import { Effect } from 'effect';
import { InvalidDeviceDetailsError } from '../errors/invalid-device-details-error.ts';

export const requireDeviceDetail = Effect.fn('Access.requireDeviceDetail')(
  function* (value: string | undefined) {
    if (value === undefined) return yield* new InvalidDeviceDetailsError();
    return value;
  },
);
