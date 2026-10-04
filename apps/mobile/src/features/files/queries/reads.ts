import { useQuery } from '@tanstack/react-query';
import {
  directoryQueryOptions,
  pathsQueryOptions,
  textQueryOptions,
  type FilesContext,
} from '@porcelain/client/files';

export function useDirectory(
  { connection, scope }: FilesContext,
  path: string,
) {
  return useQuery({
    ...directoryQueryOptions(scope, connection, path),
    retry: false,
  });
}

export function useFilePaths({ connection, scope }: FilesContext) {
  return useQuery({ ...pathsQueryOptions(scope, connection), retry: false });
}

export function useFileText({ connection, scope }: FilesContext, path: string) {
  return useQuery({
    ...textQueryOptions(scope, connection, path),
    retry: false,
  });
}
