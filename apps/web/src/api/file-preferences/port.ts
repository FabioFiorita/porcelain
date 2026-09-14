import type {
  FilePreferencesResponse,
  SetFilePreferenceRequest,
} from '../../domain/file-preferences';

export type FilePreferencesRequest = {
  projectId: string;
  token: string;
  signal: AbortSignal;
};

export type FilePreferencesPort = {
  list(request: FilePreferencesRequest): Promise<FilePreferencesResponse>;
  set(
    request: FilePreferencesRequest & { input: SetFilePreferenceRequest },
  ): Promise<FilePreferencesResponse>;
};
