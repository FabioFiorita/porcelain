---
name: maintain-verification
description: Check changed maps plus three random unchanged maps, drive them through the verification CLIs, and correct drift. Full passes require an explicit request.
---

# Maintain verification

Run on request or an existing schedule; do not create a schedule. Follow AGENTS.md for proof, sweeps and shipping. Scope: verification skills, `verify-core` and references to moved CLI files. Report product regressions with evidence; keep them out of this change.

## Select

1. Read `last-pass.json` beside this skill. `commit` is the checked source, `mode` and `maps` state coverage; `bootstrap` means no earlier completed pass is known. If the commit is missing or not an ancestor of HEAD, ask for a baseline.
2. Select changed maps with `git diff --name-only <commit> -- '.agents/skills/*-verify/features/*.md'`. Check changed indexes and deletions against their files and source.
3. Add three random unchanged maps without replacement from `git ls-files '.agents/skills/*-verify/features/*.md'`; exclude indexes and record the draw. Only an explicit full-pass request selects every map. Exclude `app.installed-lock.md` unless the owner requested that check.
4. Read commits since the baseline for changed flows; correct or add useful journey guidance. Check links and navigation against the source without introducing a map schema, source inventory or CI gate.

## Drive

Read selected maps against source, then drive their steps through each surface's skill and compare the evidence. Share instances where setup permits; run `doctor` after failures and stop your instances. Correct map/CLI drift and drive it again.

## Record

After every selected map succeeds, update `last-pass.json`: checked source commit (before the checkpoint commit), UTC date, mode (`incremental` or `full`) and exact driven paths. Commit the checkpoint even for a clean pass.

Report **clean**, **changed** or **blocked**, coverage per surface, the random sample, corrections/regressions and evidence folders. If any selected feature is unreachable, name the prerequisite and attempted step, and leave the checkpoint unchanged. Partial coverage never claims a full pass.
