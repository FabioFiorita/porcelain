/**
 * The two prompts Settings → Personalization offers to copy.
 *
 * They are TEXT, never a button that runs. Porcelain never writes a profile on
 * its own initiative and does not host agents, so
 * the product surface for "set my profile up" is a paragraph you hand to the
 * agent you already have. That is also what keeps the result honest: your agent
 * proposes, you read it, and the layers stay declarative rather than a guess
 * Porcelain made about your architecture.
 *
 * Neither prompt names a language, a framework, or a directory. `node_modules`
 * is the obvious example and exactly the wrong one to ship — most repositories
 * do not have one, and an agent that reads the repository in front of it
 * produces a better answer than any list we could hardcode.
 */

/** How far back the starter prompt reads. The window is visible in the text on purpose. */
export const PROFILE_HISTORY_WINDOWS = ['7 days', '30 days', '90 days'] as const
export type ProfileHistoryWindow = (typeof PROFILE_HISTORY_WINDOWS)[number]

/**
 * First run: derive a project baseline from what this person actually touches.
 *
 * The git-history read is the whole idea — a profile guessed from directory
 * names is a confident wrong answer, while a profile derived from your own
 * commits and reviewed by you before it is written is neither guessed nor
 * hand-curated.
 */
export function profileStarterPrompt(window: ProfileHistoryWindow = '30 days'): string {
  return `Set up my Porcelain profile for this repository.

1. Read where I actually work: \`git log --author="$(git config user.email)" --since="${window}" --name-only --pretty=format:\` and count which directories come up.
2. Work out what is noise here rather than assuming a language — read .gitignore, the build config, and the directory listing to find dependency directories, build output, generated code, and lockfiles.
3. Propose a project profile: pin what I would open on any task in this repo, hide the noise, and declare layer order from the path a change actually travels through my own directory structure. Layers are { label, pattern } where pattern is a regular expression matched against repo-relative paths.
4. Show me the JSON and wait. Once I say yes, write it with the \`porcelain_profile\` tool — \`workspace\` this checkout's absolute path, \`level\` project, \`op\` set.

This is the baseline every worktree inherits, so keep it to what is true whatever I am working on. Anything task-shaped belongs in a worktree override instead.`
}

/**
 * Standing instruction for the user's own agent file, so the profile keeps up
 * with the work without anyone remembering to ask. This is the half that solves
 * the actual problem: a profile set once at project start goes stale the moment
 * the work changes shape, and nobody goes back to fix it by hand.
 */
export const PROFILE_KEEPER_PROMPT = `## Porcelain profile

This worktree's Porcelain profile — pinned paths, hidden paths, and story layer
order — is meant to mutate. When you start substantial work here, set it to match
*that* task with the \`porcelain_profile\` tool: \`workspace\` this checkout's
absolute path, \`level\` worktree, \`op\` set, and a profile of
{ pinnedPaths, hiddenPaths, unhiddenPaths, layers }. When the work changes shape,
update it. When the work is done, \`op\` clear puts this worktree back to
inheriting the project baseline.

Pins and hides add to the project baseline; \`unhiddenPaths\` lets this worktree
see something the project hides; \`layers\` replaces the project's order when set,
and \`null\` inherits it. \`op\` set replaces the whole level, so read it back with
\`op\` get before you write — a stale profile is worse than none.`

/** Where the keeper prompt belongs — a file the agent reads, not a Porcelain setting. */
export const PROFILE_KEEPER_TARGETS = ['AGENTS.md', 'CLAUDE.md', 'AGENTS.local.md'] as const
