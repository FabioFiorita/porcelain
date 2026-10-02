---
name: maintain-verification
description: Periodic pass that keeps Porcelain's verification skills honest. It reads every feature-map entry against the source, drives every feature live through its surface's control CLI, and ships at most one commit of proven corrections to the maps and CLIs. Use for a scheduled maintenance run or when asked to audit the verification skills or feature maps.
---

# Maintain verification

A feature map rots as soon as the app changes. This pass keeps `server-verify`, `web-verify`, `desktop-verify` and `mobile-verify` true to the app. The unit of rigour is the feature: every map entry gets a source reading and a live drive.

## Outcome

End in exactly one, and say which:

- **clean:** every feature was read and driven; nothing to correct. No commit.
- **changed:** one commit of proven corrections to maps or CLIs, pushed after `pnpm check` passes.
- **blocked:** coverage could not finish, or a proven correction could not ship. Name exactly what blocked it.

## Edit scope

Edit only the four skill folders: their `SKILL.md`, `features/` and `scripts/`. Never edit product code, tests or guards during a pass. When the app no longer does what a map entry says, decide which it is: the map drifted (fix the map) or the product regressed (report it, and leave the map stating the promise).

## Pass

1. **Index.** For each surface, compare `features/README.md` with the files beside it and fix missing, extra or dead entries. Run `pnpm check`: its feature-map check names routes, screens, selectors, tests and API routes that no longer exist.
2. **Source wave.** One read-only subagent per feature file, in parallel. Each reads the feature's source from its frontmatter and the code it reaches, and returns: a summary of how the feature works now, any drift from the map entry with file and line, and the drive steps as `scripts/cli` lines. Subagents never drive the app and never edit.
3. **Reconcile.** Every feature file has a returned summary. Spot-check the cited drift. Look through the commits since the last pass for routes, screens or flows that no map names, and name the source path of each before calling it missing.
4. **Live pass.** Required even when the source looks clean. For each surface, `scripts/cli start` one instance, run `scripts/cli doctor`, then drive every feature with its map's steps and check each end state against the evidence. After any failed drive, run `doctor` again; when it reports trouble, `stop` and `start` again rather than driving a broken instance. Surfaces may run in parallel, each with its own instance. A feature that can't be reached is recorded with the prerequisite it needs (macOS, a simulator, a physical device) and the step attempted. `stop` every instance at the end; the evidence folders stay.
5. **Triage.** A wrong or missing step or description is map drift: fix it. Working behaviour the CLI can't drive is a CLI gap: fix the CLI, document the command in its `SKILL.md`, and drive the feature again with the fix. Broken behaviour is a product regression: record it for the owner and keep it out of the commit.
6. **Ship or stop.** For **changed**: re-read every changed file, run `pnpm check`, commit only those paths with one short imperative sentence, and push the branch. For **clean** or **blocked**: no commit.

## Report

The outcome; features read and driven per surface; unreachable features with their prerequisite; drift fixed; CLI gaps fixed; product regressions found, each with its evidence folder and the step that failed.
