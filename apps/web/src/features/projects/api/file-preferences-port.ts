import type {
  FilePreferencesResponse,
  SetFilePreferenceRequest,
} from '../file-preferences';

export type FilePreferencesRequest = {
  projectId: string;
  signal: AbortSignal;
};

export type FilePreferencesPort = {
  list(request: FilePreferencesRequest): Promise<FilePreferencesResponse>;
  set(
    request: FilePreferencesRequest & { input: SetFilePreferenceRequest },
  ): Promise<FilePreferencesResponse>;
};
