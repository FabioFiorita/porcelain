import {
  type FilesQuery,
  filesQuerySchema,
  filesTreeQuerySchema,
} from '@porcelain/client-runtime/files'
import { z } from 'zod'

/** Mobile React Query key: Files identity + active daemon environment. */
export type FilesQueryKey = readonly ['daemon', string, FilesQuery]

const filesQueryKeySchema = z.tuple([z.literal('daemon'), z.string(), filesQuerySchema])
const filesTreeQueryKeySchema = z.tuple([z.literal('daemon'), z.string(), filesTreeQuerySchema])

export function filesQueryKey(environmentId: string, query: FilesQuery): FilesQueryKey {
  return ['daemon', environmentId, query] as const
}

export function filesQueryKeyForIdentity(
  environmentId: string,
  identity: FilesQuery,
): FilesQueryKey {
  return filesQueryKey(environmentId, identity)
}

export function parseFilesQueryKey(
  queryKey: readonly unknown[],
): { environmentId: string; query: FilesQuery } | null {
  const parsed = filesQueryKeySchema.safeParse(queryKey)
  if (!parsed.success) return null
  return { environmentId: parsed.data[1], query: parsed.data[2] }
}

export function isFilesQueryKey(queryKey: readonly unknown[]): boolean {
  return filesQueryKeySchema.safeParse(queryKey).success
}

export function isFilesTreeQueryKey(queryKey: readonly unknown[]): boolean {
  return filesTreeQueryKeySchema.safeParse(queryKey).success
}
