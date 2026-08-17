# Shell layout: navigator left, panel right, terminal below

One window, four regions, and each region answers one question.

**Left — the worktree navigator, and nothing else.** Projects expand to worktrees; selecting one
switches the whole window to it. Creating a worktree picks a branch and a destination and runs the
repository's `create` hook; disposing of one runs its `dispose` hook. This rail is the product's
spine, so it holds no file lists, no commit lists, and no search — those moved right when the
navigator moved in.

**Centre — the viewer.** The file, diff, or changeset being read. Never called an editor.

**Right — panel tabs.** Files, diff, changeset, history, pull request, tasks, canvas, search. This
is where a surface goes when it supports reading rather than being read.

**Below — a terminal strip.** Sized for a dev server and a stray command, not for hosting an agent.
Terminal stops being a first-class tab kind; that sizing was a harness-era assumption and Porcelain
is not a harness.

**Retired tab kinds:** `terminal` (now the bottom strip) and `explore` (now a Canvas template, ADR
0004). **`commit` stays** and absorbs surfaces as others retire — it is the natural home for git
detail that no longer justifies its own tab.

**Nothing exists to fill a region.** Several right-panel surfaces were added when the right side had
too little in it and the left side had too much. Once the navigator owns the left and the panel owns
the right, that pressure is gone, and any surface that cannot name the pillar it serves is deleted
rather than rehomed.

**On resembling t3code.** The region structure is deliberately close to t3code's, which is a good
layout arrived at by people who use it all day. Copy the structure, not the content model: t3code's
spine is a thread list and every choice it makes serves *which conversation am I in*. Porcelain's
spine is worktrees, and every choice must serve *which change am I reading*. Same boxes, different
contents — importing the content model would reimport the harness assumptions this ADR exists to
remove.
