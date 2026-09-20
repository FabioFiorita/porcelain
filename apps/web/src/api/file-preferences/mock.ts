import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { setFilePreferenceRequestSchema } from '@porcelain/contracts/file-preferences';
import type {
  FilePreference,
  FilePreferencesResponse,
} from '../../domain/file-preferences';
import type { createMockStore } from '../inventory/mock';
import { createInventoryMock } from '../inventory/mock';
import type { FilePreferencesPort, FilePreferencesRequest } from './port';

type MockStore = ReturnType<typeof createMockStore>;

async function readContext(store: MockStore, request: FilePreferencesRequest) {
  const inventory = await createInventoryMock(store).read({
    signal: request.signal,
  });
  if (!inventory.projects.some((project) => project.id === request.projectId))
    throw new ConnectionError('That project is no longer available.');
  if (store.filePreferencesFailed)
    throw new ConnectionError(
      'File preferences could not be loaded or saved. Try again.',
    );
  request.signal.throwIfAborted();
}

function snapshot(
  preferences: readonly FilePreference[],
): FilePreferencesResponse {
  return {
    preferences: structuredClone(
      [...preferences].toSorted((left, right) =>
        left.path.localeCompare(right.path),
      ),
    ),
  };
}

export function createFilePreferencesMock(
  store: MockStore,
): FilePreferencesPort {
  return {
    async list(request) {
      await readContext(store, request);
      return snapshot(store.filePreferences[request.projectId] ?? []);
    },
    async set(request) {
      await readContext(store, request);
      const input = setFilePreferenceRequestSchema.parse(request.input);
      request.signal.throwIfAborted();
      const current = new Map(
        (store.filePreferences[request.projectId] ?? []).map((preference) => [
          preference.path,
          preference,
        ]),
      );
      const previous = current.get(input.path) ?? {
        path: input.path,
        pinned: false,
        hidden: false,
      };
      const updated = { ...previous, [input.flag]: input.value };
      if (!updated.pinned && !updated.hidden) current.delete(input.path);
      else current.set(input.path, updated);
      const preferences = [...current.values()];
      store.filePreferences[request.projectId] = preferences;
      return snapshot(preferences);
    },
  };
}
