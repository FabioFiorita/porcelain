import { Effect, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import type { SetFilePreferenceRequest } from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import {
  FilePreferencesState,
  filePreferencesRuntime,
} from '../store/file-preferences.ts';

export const setFilePreference = Atom.family(
  ({
    connection,
    projectId,
  }: {
    connection: RuntimeConnection;
    projectId: string;
  }) =>
    filePreferencesRuntime({ connection, projectId }).fn(
      (input: SetFilePreferenceRequest) =>
        Effect.gen(function* () {
          const api = yield* porcelainClient(connection);
          const preferences = yield* FilePreferencesState;
          return yield* preferences.confirm(
            requestEffect(
              api.projects.setFilePreference({
                params: { projectId },
                payload: input,
              }),
              connection.request,
            ),
            (_, answer) => Option.some(answer),
          );
        }),
      { concurrent: true },
    ),
);
