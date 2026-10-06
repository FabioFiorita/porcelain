import { Effect, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import {
  FilePreferencesState,
  filePreferencesRuntime,
} from '../store/file-preferences.ts';

export const readFilePreferences = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    filePreferencesRuntime(input)
      .atom(
        Stream.unwrap(
          Effect.map(FilePreferencesState, (preferences) => preferences.stream),
        ),
      )
      .pipe(
        Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
        Atom.setIdleTTL(0),
      ),
);
