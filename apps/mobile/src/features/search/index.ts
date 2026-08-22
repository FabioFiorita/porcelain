export type { SearchCodeOptions } from '@porcelain/client-runtime/search'
export type {
  CodeSearchFile,
  CodeSearchLine,
  CodeSearchResult,
  GrepMatch,
  SearchResult,
} from '@porcelain/contracts/search'
export { ContentResults } from './content-results'
export { SearchCompanion } from './search-companion'
export { useCodeSearch, useFileSearch, useTextSearch } from './search-data'

export {
  applySearchForeignDependencies,
  applySearchFreshnessRequirement,
  applySearchNotification,
  SearchNotificationBridge,
} from './search-notifications'
export { SearchPanel } from './search-panel'
export { SearchPhoneScreen } from './search-phone-screen'
export { SearchSurfacePanel } from './search-surface-panel'
export {
  invalidateAllSearchQueries,
  invalidateSearchEffects,
  invalidateSearchProjectQueries,
  isSearchQueryKey,
  parseSearchQueryKey,
  searchQueryMatchesEffect,
} from './search-query-filter'
export { searchQueryKey } from './search-query-key'
export { useSearchStore } from './search-store'
