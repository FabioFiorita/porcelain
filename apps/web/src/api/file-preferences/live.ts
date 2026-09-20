import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { UnauthorizedError } from '@porcelain/client/errors/unauthorized-error';
import {
  filePreferencesResponseSchema,
  setFilePreferenceRequestSchema,
} from '@porcelain/contracts/file-preferences';
import type { FilePreferencesPort, FilePreferencesRequest } from './port';

export function createFilePreferencesLive(
  transport: typeof fetch,
  endpoint = '/api',
): FilePreferencesPort {
  const preferencesPath = (projectId: string) =>
    `${endpoint}/projects/${encodeURIComponent(projectId)}/file-preferences`;

  async function request(
    input: FilePreferencesRequest,
    method: 'GET' | 'PUT',
    body?: unknown,
  ) {
    try {
      const payload =
        body === undefined
          ? undefined
          : setFilePreferenceRequestSchema.parse(body);
      const response = await transport(preferencesPath(input.projectId), {
        method,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        ...(payload === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' } }),
        signal: input.signal,
        redirect: 'error',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok)
        throw new ConnectionError(
          'File preferences could not be loaded or saved. Try again.',
        );
      const parsed = filePreferencesResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success)
        throw new ConnectionError(
          'The server returned incompatible file preferences.',
        );
      return parsed.data;
    } catch (error) {
      if (input.signal.aborted || error instanceof ConnectionError) throw error;
      throw new ConnectionError(
        'Could not reach file preferences. Check that the server is running.',
        { cause: error },
      );
    }
  }

  return {
    list: (input) => request(input, 'GET'),
    set: (input) => request(input, 'PUT', input.input),
  };
}
