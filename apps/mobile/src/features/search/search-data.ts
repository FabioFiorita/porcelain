/** Search's public data surface; transport lives in the Search feature hook seam. */

export type { SearchCodeOptions } from '@porcelain/client-runtime/search'
export type {
  CodeSearchFile,
  CodeSearchLine,
  CodeSearchResult,
  GrepMatch,
  SearchResult,
} from '@porcelain/contracts/search'
export { useCodeSearch, useFileSearch, useTextSearch } from './use-search-data'
