import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ApiError, type ReviewScope } from '../api/api';
import type {
  CreateEntryRequest,
  FileEditResponse,
  MoveEntryRequest,
  RemoveEntryRequest,
  TextResponse,
} from '../contracts/files';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

/** A file the reader can show, or one the server refused to read as text. */
export type TextFile =
  | ({ kind: 'text' } & TextResponse)
  | { kind: 'unreadable'; reason: 'unsupported-text' | 'too-large' };

const UNREADABLE_CODES: Record<string, 'unsupported-text' | 'too-large'> = {
  UNSUPPORTED_TEXT: 'unsupported-text',
  FILE_TOO_LARGE: 'too-large',
};

/**
 * A file's text: a plain disk read, no Git. Binary, other encodings and oversized
 * files resolve as `unreadable` so the document shows a placeholder; anything else
 * throws to the ReviewBoundary. It reloads when the live channel names the path.
 */
export function useTextFile(scope: ReviewScope, path: string) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'text', path),
    queryFn: async ({ signal }): Promise<TextFile> => {
      try {
        return {
          kind: 'text',
          ...(await api.files.text({ ...scope, signal, path })),
        };
      } catch (error) {
        const reason =
          error instanceof ApiError ? UNREADABLE_CODES[error.code] : undefined;
        if (reason == null) throw error;
        return { kind: 'unreadable', reason };
      }
    },
  }).data;
}

/** One folder, loaded when it is opened. The root is "". */
export function useDirectory(scope: ReviewScope, path: string, enabled = true) {
  const { api, environmentId } = useWorkspaceContext();
  return useQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'directory', path),
    queryFn: ({ signal }) => api.files.directory({ ...scope, signal, path }),
    enabled,
  });
}

/** Every opened folder at once, each kept current by the live channel. */
export function useDirectories(scope: ReviewScope, paths: readonly string[]) {
  const { api, environmentId } = useWorkspaceContext();
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.resource(environmentId, scope, 'directory', path),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.files.directory({ ...scope, signal, path }),
    })),
  });
}

/** Loads a folder imperatively (the tree asks for children as folders expand). */
export function useLoadDirectory(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return (path: string) =>
    client.fetchQuery({
      queryKey: queryKeys.resource(environmentId, scope, 'directory', path),
      queryFn: ({ signal }) => api.files.directory({ ...scope, signal, path }),
    });
}

/** Quick open: one `git ls-files` on the server, best matches first. */
export function useFileSearch(
  scope: ReviewScope,
  query: string,
  enabled: boolean,
) {
  const { api, environmentId } = useWorkspaceContext();
  const result = useQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'search', query),
    queryFn: ({ signal }) => api.files.search({ ...scope, signal, query }),
    enabled,
    placeholderData: (previous) => previous,
  });
  return {
    paths: result.data?.paths ?? [],
    truncated: result.data?.truncated ?? false,
    isFetching: result.isFetching,
  };
}

/** A save refused because the file changed on disk after it was opened. */
export const isFileChanged = (error: unknown) =>
  error instanceof ApiError && error.code === 'FILE_CHANGED';

/** The signed link an image or HTML file shows from; `revision` reads it at a commit. */
export function usePreviewLink(
  scope: ReviewScope,
  path: string,
  revision?: string,
) {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(
      environmentId,
      scope,
      'preview',
      path,
      revision ?? 'disk',
    ),
    queryFn: ({ signal }) =>
      api.files.previewLink({ ...scope, signal, path, revision }),
  }).data;
}

/**
 * Create, move and delete answer with the paths they touched; the live channel
 * reloads exactly those (the folders, the list of changes). Nothing else refetches.
 */
function useFileEdit<TInput>(
  run: (input: TInput) => Promise<FileEditResponse>,
) {
  return asMutation(useMutation({ mutationFn: run }));
}

export function useCreateEntry(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useFileEdit((input: CreateEntryRequest) =>
    api.files.create({ ...scope, input }),
  );
}

export function useMoveEntry(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useFileEdit((input: MoveEntryRequest) =>
    api.files.move({ ...scope, input }),
  );
}

/** Moves to the system trash, so it can be recovered. */
export function useRemoveEntry(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useFileEdit((input: RemoveEntryRequest) =>
    api.files.remove({ ...scope, input }),
  );
}

/**
 * Saving an edit. The response replaces the cached file so the editor reopens on
 * what was saved; only that file and the list of changes reload after it.
 */
export function useWriteFile(scope: ReviewScope) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: {
        path: string;
        text: string;
        expectedFingerprint: string;
      }) => api.files.write({ ...scope, input }),
      onSuccess: (response: TextResponse) => {
        client.setQueryData(
          queryKeys.resource(environmentId, scope, 'text', response.path),
          { kind: 'text', ...response },
        );
      },
    }),
  );
}
