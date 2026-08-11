/** Search's public data surface; transport lives in the use- hook seam. */

export type {
  CodeSearchFile,
  CodeSearchLine,
  CodeSearchOptions,
  CodeSearchResult,
  FileSearchResult,
  GrepMatch,
} from '@/lib/daemon/procedures/files'
export { searchCodeQuery, searchFilesQuery } from '@/lib/daemon/procedures/files'
export { useCodeSearch, useFileSearch } from './use-search-data'
