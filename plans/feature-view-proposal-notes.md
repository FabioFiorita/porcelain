# Feature view → "the Review" (Atlas-style) — design notes

## What Atlas actually is (from the blog)
- 3 panels: left = cohorts/layers nav; center = the diff as a guided walkthrough; right = per-range context/summaries.
- Changes reorganized into "change cohorts" → "ordered layers" = how a senior engineer would explain it.
- Per-layer AI summaries ANCHORED to line ranges; diagrams (sequence/state/ER) generated when they illuminate.
- Active summary sync: scrolling code highlights matching narrative in right panel.
- J/K/Z keyboard nav.

## What Porcelain already has (huge overlap)
- Flow layers = ordered layers (already the heart of the product).
- Review set (agent-fed manifest) with changed/context/shipped + per-file layer + invariants annotations.
- Reading surface (reading-surface.tsx) — one document: diff hunks + symbol slices. This IS the center panel already.
- Feature artifact (HTML explainer) — currently a SEPARATE tab.
- Loop evidence (HTML proof) — currently a SEPARATE tab.
- Review comments + reviewed marks + Quick Access (commit composer, comments).
- Missing: narrative sections anchored to ranges, diagrams, active sync, unified single read, J/K.

## Proposal: ONE document, "the Review"
Feature view becomes a single agent-authored document in the viewer:
1. **Header**: feature title + agent's one-paragraph thesis + stats (files by badge kind).
2. **Walkthrough sections** (agent-authored, ordered by flow layer): each = prose (markdown) + optional diagram (mermaid or inline SVG, sandboxed same as artifact) + the anchored code slices (existing reading surface blocks) inline under the prose.
3. **Evidence chapter** at the end: loop evidence folds in (screenshots, pass/fail) — review ends with proof the loop closed.
4. Artifact = becomes the walkthrough (merge concept: the artifact's narrative IS sections' prose). Keep separate artifact tab kind for backward compat initially or deprecate.
- Left (Feature list) = outline: sections/layers + per-file reviewed checkboxes + progress.
- Right (Quick Access) = active-sync context: current section summary, invariants to check for visible range, comments on visible file, reviewed toggle, commit composer stays.
- J/K = next/prev section; Z = zen (collapse chrome).
- **Empty by default, agent-created**: no baseline regex fallback as the primary; empty state = "No review yet — ask your agent to publish one" + copyable skill command. Baseline demoted to a link ("Show import-graph baseline").

## MCP/schema changes
- Extend review-set schema: `sections: [{ title, prose (md), diagram?, anchors: [{file, range?}] }]` — or reuse artifact channel? Cleaner: sections on the review set; artifact channel then deprecated → becomes "walkthrough" content. Evidence stays own channel (ephemeral) but renders into the doc.
- Update companion skill review-with-porcelain to author sections.

## Phasing (each is a shippable slice)
1. Unified read: fold artifact + evidence into feature view as chapters (no schema change — render existing channels inline). Empty-state redesign.
2. Sections schema + skill update + outline left nav + J/K.
3. Active summary sync + per-range invariants in Quick Access.
4. Diagrams guidance in skill (mermaid → SVG sandboxed).

## Open questions for Fabio
- Keep baseline (import-graph) mode at all, or agent-only + explore for comprehension?
- Artifact channel: deprecate into sections, or keep as "long-form appendix"?
