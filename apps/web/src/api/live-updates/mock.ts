import type { LiveUpdatePort } from './port';

export function createLiveUpdatesMock(): LiveUpdatePort {
  return {
    connect: () => ({ subscribe: () => undefined }),
  };
}
