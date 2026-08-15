# Migrate the repo-local companion into its new owners

One-time, explicit, and idempotent. Run it when the human asks to move a repository off the legacy
`.porcelain/` companion — never as part of ordinary work, and never "just to be safe".

```bash
~/.porcelain/porcelain migrate apply --dry-run                  # print the plan; write nothing
~/.porcelain/porcelain migrate apply                            # do it
~/.porcelain/porcelain migrate apply --report /tmp/migration.json
```

The checkout must already be open in Porcelain once, so it has a stable Project id. Everything is
written to the daemon-root Project store under `$PORCELAIN_HOME`; the legacy files stay exactly
where they are. Deleting `.porcelain/` afterwards is the human's call, made after reading the report.

## What becomes what

| Legacy | New owner |
|---|---|
| `active-review/`, `reviews/<id>/` | One Canvas per review, Review template, four sections: Intent (thesis + `intent/`), Process (walkthrough sections), Execution (declared files), Evidence (checks + `results/` + gallery). Images and video are copied into the Canvas bundle's `assets/`. |
| `board.json` | Tasks, keeping the card id, referencing this Project and — when a card names a branch or checkout path exactly — that Worktree. An unrecognised column becomes `todo` with a `migrated` tag. |
| `actions.json` | The Project's Actions in the daemon store. Ids and titles already present are skipped. A migrated Action is **unreviewed**: the human still sees the trust prompt before it runs. |
| `scope.json` | The Project's private hide/pin defaults in the daemon store. Never the tracked `.porcelain/project.json` — that one is only ever written by an explicit `project promote-overrides`. |
| `layers.json`, `notes.md`, terminal images | Retired. Named in the report, never copied. |

## Reading the report

Each line is `[outcome] kind: source — detail`, with `converted`, `already-migrated`,
`unsupported`, or `failed`. Answer the human with the counts, then anything `unsupported` or
`failed` — those are the only lines that need a decision.

A `failed` line is safe to retry: the ledger at `$PORCELAIN_HOME/projects/<id>/migration.json` only
records what actually landed, so running `migrate apply` again picks up exactly what is missing and
converts nothing a second time.
