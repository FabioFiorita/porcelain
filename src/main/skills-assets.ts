// Skills metadata for the skills.sh-packaged companion skill (porcelain-companion).
// The SKILL.md + references live at the repo root under /skills/porcelain-companion/.

/** Bump whenever the bundled skills change so the update toast prompts `npx skills upgrade`. */
export const SKILLS_VERSION = '3.0.0'

/** Repository slug passed to `npx skills add`. */
export const SKILLS_REPO = 'FabioFiorita/porcelain'

export function skillsInstallCommand(): string {
  return `npx skills add ${SKILLS_REPO}`
}

export function skillsUpgradeCommand(): string {
  return 'npx skills upgrade'
}
