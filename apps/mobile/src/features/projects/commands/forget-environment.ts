import { Effect } from 'effect';
import { projectSelectionStore } from '../store';

export function useForgetProjectEnvironment() {
  return (environmentId: string) =>
    Effect.runPromise(projectSelectionStore.forgetEnvironment(environmentId));
}
