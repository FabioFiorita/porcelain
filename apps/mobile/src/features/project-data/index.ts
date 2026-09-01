/**
 * Mobile Project Data feature public entry point.
 *
 * Settings, Files companion, and Review publish import this module only —
 * never a Project Data implementation file.
 */

export { applyProjectDataFreshnessRequirement } from './project-data-freshness'
export { ProjectDataFreshnessBridge } from './project-data-freshness-bridge'
export { useCompanionGitVisibility } from './project-data-queries'
export { invalidateAllProjectDataQueries } from './project-data-query-key'
export {
  type CompanionData,
  useCompanionData,
} from './project-data-settings'
