import {
  listFilePreferencesResponseSchema,
  setFilePreferenceRequestSchema,
  setFilePreferenceResponseSchema,
} from '@porcelain/contracts/projects';
import { requestJson } from '../../../shared/api/request';
import type { FilePreferencesPort } from './file-preferences-port';

export function createFilePreferencesLive(
  transport: typeof fetch,
): FilePreferencesPort {
  const preferencesPath = (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/file-preferences`;

  return {
    list: ({ projectId, signal }) =>
      requestJson(
        transport,
        preferencesPath(projectId),
        listFilePreferencesResponseSchema,
        { signal },
      ),
    set: ({ projectId, signal, input }) =>
      requestJson(
        transport,
        preferencesPath(projectId),
        setFilePreferenceResponseSchema,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(setFilePreferenceRequestSchema.parse(input)),
          signal,
        },
      ),
  };
}
