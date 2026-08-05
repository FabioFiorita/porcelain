// Skills metadata for the skills.sh-packaged companion skill (porcelain-companion).
// The SKILL.md + references live at the repo root under /skills/porcelain-companion/.

/**
 * The skill ships with the app, so it carries the app's version rather than a private one.
 * A hand-bumped constant only told the truth when someone remembered to bump it; this cannot
 * drift. `scripts/sync-versions.mjs` stamps the same string into SKILL.md's frontmatter.
 */
export const SKILLS_VERSION = __PORCELAIN_VERSION__

/** Repository slug passed to `npx skills add`. */
const SKILLS_REPO = 'FabioFiorita/porcelain'

/** Global install so every agent project sees the companion skill, not just one cwd. */
export function skillsInstallCommand(): string {
  return `npx skills add ${SKILLS_REPO} -g`
}

export function skillsUpgradeCommand(): string {
  return 'npx skills upgrade -g'
}
