---
name: maintain-verification
description: Check maps changed since the recorded verification pass plus a small random sample, drive the selected features through their control CLIs, and correct proven drift. Drive every feature only when explicitly requested.
---

# Maintain verification

Run on request or from an explicitly configured schedule; this skill creates no schedule. The default pass reads and drives maps touched since `last-pass.json`'s commit, plus three randomly chosen unchanged maps. A full pass requires an explicit request. The server has no map: check its contract when a selected feature reaches it.

## Select the pass

1. Read `.agents/skills/maintain-verification/last-pass.json`. Its commit is the source snapshot checked by the last completed pass, not a claim that every feature was driven. `mode` and `maps` say what was covered. A `bootstrap` record is only an initial selection boundary; no earlier completed pass is known.
2. Check that the commit exists and is an ancestor of HEAD. If not, stop and ask for the baseline; do not silently select everything or reset it.
3. List maps changed since that commit, including local edits, using `git diff --name-only <commit> -- '.agents/skills/*-verify/features/*.md'`. Select every surviving map in that list, except `README.md`. A changed index requires comparing its links with the files beside it. A deleted map requires checking its former source and index entry, not driving a deleted feature.
4. Pick three unchanged maps at random from `git ls-files '.agents/skills/*-verify/features/*.md'`, excluding indexes and the changed set. Use a random draw without replacement, and record the paths before reading them. Never include `app.installed-lock.md` unless the owner explicitly requested the installed-app check. A full pass selects all eligible maps instead and records that exclusion.
5. Read commits since the baseline for unmapped routes, screens and flows. Name a concrete source path before reporting a missing map. Add any relevant existing map to the selection. Run `pnpm features:check` for the repository-wide indexes, selectors, tests and route coverage.

## Read, drive and correct

Read each selected map against its source and the code it reaches. Drive its **Driving it** steps through the surface's verification skill, compare the recorded evidence with each promised end state, and stop every instance you started. Share one instance per surface where the map's setup allows it. After a failed drive, run `doctor`; restart an unhealthy instance before continuing.

Map drift gets a corrected map. Behaviour the CLI cannot drive gets a CLI correction, its usage text and another drive. A product regression gets an evidence-backed report for the owner; keep it out of this maintenance commit. Sweep sibling skills, apps, importers, old paths, indexes and repository counters for copies of every correction. Run `pnpm check`, changed test files by name and affected probes by name; full suites belong to CI.

Scope: the four verification skill folders, `verify-core`, this skill and the necessary references to moved CLI files. Broader product changes need their own task. Commit only changed paths, at most one correction commit, and push the branch.

## Record and report

After all selected maps have been read and driven successfully, update `last-pass.json` with the full hash of the source commit just checked, UTC date, `mode: "incremental"` or `"full"`, and the exact map paths driven. Commit the checkpoint with the corrections; if corrections need a new source commit first, a separate checkpoint commit is allowed. A clean pass still commits its checkpoint. The checkpoint commit itself is not the source baseline, avoiding a self-referential hash.

If any selected feature cannot be reached, record the prerequisite, attempted step and evidence in the report, leave the checkpoint unchanged and report **blocked**. Never advance past work left unverified. Otherwise report **clean** or **changed**, the baseline and new source commit, selected/read/driven counts per surface, random sample, corrections, regressions and evidence folders. A partial pass never claims full feature coverage.
