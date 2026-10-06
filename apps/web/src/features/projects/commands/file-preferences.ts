import { useAtom } from '@effect/atom-react';
import { setFilePreference } from '@porcelain/client/projects';
import {
  canonicalPreferencePath,
  type SetHiddenInput,
  type SetPinnedInput,
} from '@porcelain/client/projects/rules';
import { type Connection } from '@/shared/workspace/connection';

function useSetFilePreference(connection: Connection, projectId: string) {
  const [result, submit] = useAtom(
    setFilePreference({ connection, projectId }),
    { mode: 'promise' },
  );
  return { result, submit };
}

export function useSetHidden(connection: Connection, projectId: string) {
  const mutation = useSetFilePreference(connection, projectId);
  return {
    ...mutation,
    submit: (input: SetHiddenInput) =>
      mutation.submit({
        path: canonicalPreferencePath(input.path),
        flag: 'hidden',
        value: input.hidden,
      }),
  };
}

export function useSetPinned(connection: Connection, projectId: string) {
  const mutation = useSetFilePreference(connection, projectId);
  return {
    ...mutation,
    submit: (input: SetPinnedInput) =>
      mutation.submit({
        path: canonicalPreferencePath(input.path),
        flag: 'pinned',
        value: input.pinned,
      }),
  };
}
