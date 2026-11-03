import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { Camera } from 'expo-camera';
import { statusActivity } from '../../../shared/adapters/status-activity';

const cameraPermission = Atom.make((get) => {
  get.addFinalizer(
    statusActivity.subscribe(() => {
      if (statusActivity.isActive()) get.refreshSelf();
    }),
  );
  return Effect.promise(() => Camera.getCameraPermissionsAsync());
});

const requestCameraPermission = Atom.fn((_: void, get) =>
  Effect.gen(function* () {
    yield* Effect.promise(() => Camera.requestCameraPermissionsAsync());
    get.refresh(cameraPermission);
  }),
);

export function useCameraPermission() {
  const result = useAtomValue(cameraPermission);
  const request = useAtomSet(requestCameraPermission);
  return {
    permission: AsyncResult.isSuccess(result) ? result.value : undefined,
    request: () => request(undefined),
  };
}
