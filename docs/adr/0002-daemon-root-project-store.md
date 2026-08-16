# Daemon-root project store with explicit Git promotion

Porcelain will store default project data in the owning Environment daemon's `$PORCELAIN_HOME`, under stable Project records rather than in every repository's working tree. Those records contain private Canvases, assets, Actions, and Worktree metadata; Tasks remain daemon-wide. A repo-local `.porcelain/` is optional and appears only when the user explicitly promotes portable Canvases or project/Worktree overrides into Git. Promoted files are the tracked source of truth and the daemon indexes them without maintaining a second editable copy. Personal UI state remains client-local, and separate Environment daemons do not synchronize private project data automatically.

This keeps agent-created explanation and evidence alive when ephemeral Worktrees are deleted, avoids silently writing application state into repositories, and makes portability an intentional Git operation. Project records use stable identifiers and retain Worktree references so paths can change without confusing one Project or Worktree with another.

**Promotion changes the threat model.** An unpromoted HTML Canvas is agent-authored on this machine, by an agent this user already trusts with shell access — its `sandbox="allow-scripts"` iframe (no `allow-same-origin`) runs on an opaque origin with a `connect-src 'none'` CSP, so even a misbehaving script can't exfiltrate anything (#21). Once promoted, that same Canvas becomes a tracked file a `git clone`/`git pull` can deliver from someone else's repository — third-party HTML with runnable script. Promotion (#26) must decide this explicitly — strip scripts from a promoted Canvas, or downgrade it to `sandbox=""` — rather than silently inheriting the unpromoted policy.

**Status: promotion landed (#26).** The overlay is `<repo>/.porcelain/canvases/<id>/` (bundle files
plus a `canvas.json` manifest in the daemon-root record shape) and `<repo>/.porcelain/project.json`
(`hiddenPaths`, `pinnedPaths`, `worktrees`, deliberately the shapes `scope.json` and the client's
Worktree setup already use, so the migration is a rename). `OVERLAY_CHANNELS` in
`packages/shared/src/project-porcelain.ts` is the index: adding Actions later is one more channel
entry, one more reader, and one more `info/exclude` negation. Promotion writes plain files —
`projects.promoteCanvas`, `projects.promoteOverrides`, `projects.listOverlay`, and the matching CLI
verbs — and never stages or commits. Every mutation takes an explicit target checkout; an ambiguous
one is rejected as `projects.overlay-target-invalid`. Tracked wins over private for the same Canvas
id, and the private bundle is moved rather than copied, so there is never a second editable copy.

Git visibility works by rewriting the per-clone `$GIT_COMMON_DIR/info/exclude` block from
`.porcelain/` to `.porcelain/*` plus one negation per overlay channel. Git will not descend into an
excluded *directory*, so no negation under the old blanket rule could ever have been reached;
excluding the contents instead leaves the promoted paths visible and every other companion channel
exactly as hidden as before. A repo that already tracks its companion is left untouched.

**The threat model above is resolved by pinning `script-src`.** A promoted Canvas is served with
`script-src 'sha256-…'` naming only Porcelain's own external-link bridge, so the browser refuses
every author script — inline or external — while styles, images, and links keep working. Author
scripts are also left un-inlined rather than embedded. This is enforcement by the user agent, not
by a server-side sanitizer that would have to be complete to be safe.

Two consequences worth stating plainly. Opening a repository never creates or modifies
`.porcelain/`: the companion watcher no longer materializes the evidence tree until a review is
actually in flight. And personal UI state — pins, tab order, split layout — remains client-local;
the tracked `hiddenPaths`/`pinnedPaths` are project *defaults* the client merges under its own state.

## Migrating from the repo-local companion

**Status: migration landed (#27).** Moving to the daemon-root store does not strand the work
already in a repository. One explicit command converts it:

```bash
porcelain migrate apply --dry-run          # print the plan; write nothing
porcelain migrate apply --report /tmp/m.json
```

The same routine is `project-data.migrateCompanion({ projectId, path })` on the daemon. It lives in
`packages/shared/src/companion-migration*.ts` because the CLI has no daemon transport
(`scripts/lint-cli-boundary.mjs`) — one implementation, two entry points, no chance of two
migrations disagreeing about what a Board card becomes. There is no startup hook: a one-time store
rewrite that fires because a process restarted is a rewrite nobody chose.

| Legacy source | New owner |
|---|---|
| Legacy `active-review/` and `reviews/<id>/` | A Canvas bundle per review, `template: 'review'`, four sections (Intent ← thesis + `intent/`; Process ← walkthrough sections; Execution ← declared files; Evidence ← checks + `results/` + gallery). Evidence and intent assets are copied into the bundle's own `assets/`; no active lifecycle is retained. |
| `board.json` | Tasks, keeping the card id as the Task id, with the Project reference and a Worktree reference inferred from an exact branch or path mention. An unknown column lands in `todo`, tagged `migrated`. |
| `actions.json` | `$PORCELAIN_HOME/projects/<id>/actions.json`, skipping ids and titles already there. Trust records are untouched — a migrated Action arrives unreviewed and still meets the trust prompt. |
| `scope.json` | `$PORCELAIN_HOME/projects/<id>/project.json`, the PRIVATE counterpart of the tracked overlay. Never the tracked `.porcelain/project.json`: promoting a personal hide/pin list into someone's working tree is the exact failure this ADR exists to prevent. |
| `layers.json`, `notes.md`, terminal image passthrough | Reported as retired. No new owner, so they are named in the report rather than copied. |

Two properties make it safe to run twice. `$PORCELAIN_HOME/projects/<id>/migration.json` is a ledger
written after **every** item, so a crash resumes instead of restarting; and every writer reads its
destination and merges, so even a lost ledger cannot duplicate a row. Nothing legacy is deleted —
the report is what tells the human it is safe to remove `.porcelain/` themselves.
