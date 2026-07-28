/**
 * Copy-to-clipboard agent kickoff prompts for repo setup (flow layers + monorepo
 * scope). Same idiom as review-lifecycle prompts — paste into your coding agent;
 * never call navigator.clipboard here (use copyText at the call site).
 */

/** Unconfigured layers: agent inspects the tree and writes a full layers set. */
export function layersSetupPrompt(): string {
  return [
    'Configure Porcelain flow layers for this repository (porcelain-companion skill → layers).',
    'Layers are agent-managed for *this* tree — not a fixed React stack. Unconfigured repos start with Docs + Agents starters only; product code lands in Other until you set real groups.',
    '',
    '1. Inspect the repo layout: top-level dirs, package roots, tsconfig/project boundaries, existing README / AGENTS.md.',
    '2. Propose ordered layers entry-point → data (or docs/agents first if only those are dirty). Prefer a handful of meaningful groups; leave the long tail in Other.',
    '3. Replace the whole set (whole-set replace, not per-layer add):',
    "   porcelain layers set --layers - <<'JSON'",
    '   [',
    '     { "label": "…", "pattern": "…" }',
    '   ]',
    '   JSON',
    '4. Confirm with `porcelain layers get` and that Changes grouping looks right.',
    '',
    'Patterns match repo-relative paths. Furthest-right match wins. Examples: folder `(^|/)(routes|pages)/`, suffix `\\.(test|spec)\\.[a-z]+$`.',
    'Run from inside the repo (or pass --repo <absolute path>).',
  ].join('\n')
}

/** Empty/noisy monorepo tree: agent suggests hide/pin via the scope CLI. */
export function scopeSetupPrompt(): string {
  return [
    'Configure Porcelain monorepo focus (hide/pin) for this repository (porcelain-companion skill → scope).',
    'Hide folders that are not in play; pin the ones the human cares about so the tree stays fast and legible.',
    '',
    '1. Inspect layout: top-level packages/apps, tsconfig project references, recent commits, and (if useful) git author identity for “what this human usually touches”.',
    '2. Propose hide paths for sibling apps / packages not in play, and pin paths for the active product roots.',
    '3. Apply via the porcelain CLI (repo-relative --path preferred):',
    '   porcelain scope list',
    '   porcelain scope hide --path <rel>',
    '   porcelain scope pin --path <rel>',
    '4. Confirm `porcelain scope list` and that the Files tree looks focused (show-hidden toggle reveals hidden rows).',
    '',
    'Same channel as the app tree context menu (~/.porcelain/scope.json). scope clear drops both lists for the repo.',
    'Run from inside the repo (or pass --repo <absolute path>).',
  ].join('\n')
}
