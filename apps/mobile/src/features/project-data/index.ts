/**
 * Mobile Project Data feature public entry point (PDT-003).
 *
 * Settings, Files companion, and Review publish import this module only —
 * never a Project Data implementation file.
 */

export { applyProjectDataFreshnessRequirement } from './project-data-freshness'
export { ProjectDataFreshnessBridge } from './project-data-freshness-bridge'
export {
  useCompanionGitVisibility,
  useProjectNotes,
} from './project-data-queries'
export { invalidateAllProjectDataQueries } from './project-data-query-key'
export {
  type CompanionData,
  type ReviewLayers,
  useCompanionData,
  useReviewLayers,
} from './project-data-settings'
