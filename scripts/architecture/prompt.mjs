#!/usr/bin/env node
/**
 * Per-recipe fresh prompts for architecture group dispatch.
 */

/**
 * @param {{
 *   recipeId: string,
 *   recipePath: string,
 *   recipeStatus: string,
 *   groupId: string,
 *   packetPath: string,
 *   startingHead: string,
 * }} options
 */
export function buildRecipePrompt(options) {
  const { recipeId, recipePath, recipeStatus, groupId, packetPath, startingHead } = options

  return `You are a fresh execution agent for one Porcelain architecture recipe.

## Binding constraints

1. Load and follow the skill \`.agents/skills/execute-architecture-spec/SKILL.md\` in full.
2. Execute ONLY recipe \`${recipeId}\` (status ${recipeStatus}) at \`${recipePath}\`.
3. Do not select a different recipe. Do not begin any later recipe. Do not alter unrelated catalog/recipe statuses.
4. Rebuild context from the repository only — no prior chat, memory, resume, or subagents.
5. Run every recipe validation command, then \`pnpm lint\`, \`pnpm verify\`, and \`git diff --check\`.
6. Mark \`${recipeId}\` Landed in the recipe file and catalog only after every completion criterion passes.
7. Commit the complete unit once using repository commit conventions. Do not push. Do not open a PR.
8. Leave the worktree clean.
9. Write the required README review packet to \`${packetPath}\` (create parent dirs if needed).
10. Stop after this single recipe.

## Group context (informational only)

- Execution group: \`${groupId}\`
- Starting HEAD for this recipe process: \`${startingHead}\`
- Fresh process: you must not continue or resume any prior session.

## Required packet contents

Follow \`plans/architecture-refactor/specs/README.md\` review packet:

- recipe ID, starting commit, final commit, clean-worktree status
- changed file groups and why each changed
- every command actually run with pass/fail and counts where available
- every requested deletion search and its result
- mismatches, deviations, skipped checks, warnings, and assumptions, or \`none\`
- confirmation that nothing was pushed and no later recipe was started

Begin by reading root AGENTS.md, the specs README, the selected recipe, and every governing decision it names. Then execute.
`
}
