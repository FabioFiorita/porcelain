---
name: maintain-verification
description: Periodic pass that keeps Porcelain's verification skills honest. It reads every feature-map entry against the source, drives every feature live through its surface's control CLI, and ships at most one commit of proven corrections to the maps and CLIs. Use for a scheduled maintenance run or when asked to audit the verification skills or feature maps.
---

# Maintain verification

This pass keeps `server-verify`, `web-verify`, `desktop-verify` and `mobile-verify` true to the app. Every map entry gets a source reading and a live drive.

## Outcome

End in exactly one, and say which:

- **clean:** every feature was read and driven; nothing to correct. No commit.
- **changed:** one commit of proven corrections to maps or CLIs, pushed.
- **blocked:** coverage could not finish, or a proven correction could not ship. Name exactly what blocked it.

## Edit scope

Only the four skill folders: their `SKILL.md`, `features/` and `scripts/`. When the app no longer does what a map entry says, decide which it is: the map drifted (fix the map) or the product regressed (report it, and leave the map stating the promise).

## Pass

1. **Index.** For each surface, compare `features/README.md` with the files beside it and fix missing, extra or dead entries. Run `pnpm features:check`.
2. **Source wave.** One read-only subagent per feature file, in parallel. Each reads the feature's source from its frontmatter and the code it reaches, and returns how the feature works now, any drift from the entry with file and line, and the drive steps as `scripts/cli` lines.
3. **Reconcile.** Spot-check the cited drift. Look through the commits since the last pass for routes, screens or flows no map names, and name the source path of each before calling it missing.
4. **Live pass.** Required even when the source looks clean. Per surface, `start` one instance and drive every feature with its map's steps, checking each end state against the evidence. After a failed drive, run `doctor`; when it reports trouble, `stop` and `start` again rather than driving a broken instance. Surfaces may run in parallel. Record a feature that can't be reached with the prerequisite it needs (macOS, a simulator, a physical device) and the step attempted. `stop` every instance at the end.
5. **Triage.** A wrong or missing step or description is map drift: fix it. Working behaviour the CLI can't drive is a CLI gap: fix the CLI and its usage text, and drive the feature again. Broken behaviour is a product regression: record it for the owner and keep it out of the commit.
6. **Ship.** For **changed**: re-read every changed file, commit only those paths and push the branch.

## Report

The outcome; features read and driven per surface; unreachable features with their prerequisite; drift fixed; CLI gaps fixed; product regressions found, each with its evidence folder and the step that failed.
