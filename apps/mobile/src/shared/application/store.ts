import { Effect, Layer, ManagedRuntime } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  AccessPlatform,
  AccessStore,
  RemoteConnections,
  remoteConnectionsLayer,
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
import { remoteConnectionFactoryLayer } from '../adapters/connection-factory';
import { accessPlatform } from '../adapters/access-platform';
import { environmentStorage } from '../adapters/environment-storage';
import { projectSelectionStorage } from '../adapters/selection-storage';

const memoMap = Layer.makeMemoMapUnsafe();
const platform = Layer.succeed(AccessPlatform, accessPlatform);

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
  platform,
  remoteConnectionFactoryLayer(memoMap).pipe(Layer.provide(platform)),
  FileDrafts.layer,
);
const application = remoteConnectionsLayer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      EnvironmentCommands.layer,
      ProjectSelectionCommands.layer,
      RemoteConnections.layer,
    ).pipe(Layer.provideMerge(services)),
  ),
);
const applicationRuntime = ManagedRuntime.make(application, { memoMap });
export const clientRuntime = Atom.context({
  memoMap: applicationRuntime.memoMap,
})(application);
export const remoteConnectionState =
  applicationRuntime.runSync(RemoteConnections).state;
export const accessState = applicationRuntime.runSync(AccessStore).state;
export const selectionState = applicationRuntime.runSync(
  ProjectSelectionStore,
).state;
export const pendingSelections = applicationRuntime.runSync(
  ProjectSelectionCommands,
).pending;
