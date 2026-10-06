import { Effect, Layer, ManagedRuntime } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  AccessPlatform,
  AccessStore,
  EnvironmentCommands,
  EnvironmentMutations,
  EnvironmentStorage,
} from '@porcelain/client/access';
import { FileDrafts } from '@porcelain/client/files';
import {
  ProjectSelectionCommands,
  ProjectSelectionStorage,
  ProjectSelectionStore,
  WorkspaceSelectionCleanup,
} from '@porcelain/client/projects';
import { accessPlatform } from '../adapters/access-platform';
import { environmentStorage } from '../adapters/environment-storage';
import { projectSelectionStorage } from '../adapters/selection-storage';

const stores = Layer.mergeAll(
  AccessStore.layer,
  ProjectSelectionStore.layer,
  EnvironmentMutations.layer,
).pipe(
  Layer.provide(
    Layer.merge(
      Layer.succeed(EnvironmentStorage, environmentStorage),
      Layer.succeed(ProjectSelectionStorage, projectSelectionStorage),
    ),
  ),
);
const cleanup = Layer.effect(
  WorkspaceSelectionCleanup,
  Effect.gen(function* () {
    const selection = yield* ProjectSelectionStore;
    return { forgetEnvironment: selection.forgetEnvironment };
  }),
).pipe(Layer.provide(stores));
const services = Layer.mergeAll(
  stores,
  cleanup,
  Layer.succeed(AccessPlatform, accessPlatform),
  FileDrafts.layer,
);
const application = Layer.merge(
  EnvironmentCommands.layer,
  ProjectSelectionCommands.layer,
).pipe(Layer.provideMerge(services));
const applicationRuntime = ManagedRuntime.make(application);
export const applicationMemoMap = applicationRuntime.memoMap;
export const clientRuntime = Atom.context({
  memoMap: applicationRuntime.memoMap,
})(application);
export const accessState = applicationRuntime.runSync(AccessStore).state;
export const selectionState = applicationRuntime.runSync(
  ProjectSelectionStore,
).state;
export const pendingSelections = applicationRuntime.runSync(
  ProjectSelectionCommands,
).pending;
