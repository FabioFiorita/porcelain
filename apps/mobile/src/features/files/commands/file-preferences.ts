import { useAtom } from '@effect/atom-react';
import { setFilePreference } from '@porcelain/client/projects';
import type { SetFilePreferenceRequest } from '@porcelain/contracts/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { useState } from 'react';

export function useSetFilePreference(
  connection: RuntimeConnection,
  projectId: string,
) {
  const [request, setRequest] = useState<SetFilePreferenceRequest>();
  const [result, submit] = useAtom(
    setFilePreference({ connection, projectId }),
    { mode: 'promiseExit' },
  );
  return {
    result,
    submit: (input: SetFilePreferenceRequest) => {
      setRequest(input);
      void submit(input);
    },
    retry: () => {
      if (request) void submit(request);
    },
  };
}
