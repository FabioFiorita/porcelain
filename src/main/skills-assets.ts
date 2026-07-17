// Skills metadata for the skills.sh-packaged companion skills.
// The actual SKILL.md files live at the repo root under /skills/<name>/SKILL.md.

/** Bump whenever the bundled skills change so the update toast prompts `npx skills upgrade`. */
export const SKILLS_VERSION = '2.11.0'

/** Repository slug passed to `npx skills add`. */
export const SKILLS_REPO = 'FabioFiorita/porcelain'

export function skillsInstallCommand(): string {
  return `npx skills add ${SKILLS_REPO}`
}

export function skillsUpgradeCommand(): string {
  return 'npx skills upgrade'
}
