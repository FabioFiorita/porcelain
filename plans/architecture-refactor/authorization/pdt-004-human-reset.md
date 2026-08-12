# PDT-004 human-only production reset

## Approval
- Approved: yes
- Approved by: Fabio Fiorita
- Approved on: 2026-08-11
- Operator: human-owner-only
- Agent runnable: no
- pnpm wired: no
- Export machinery: no
- Recovery: manual-on-disk-conversion

## Named targets
| Kind | Path template | Included by default | Root disposition |
| --- | --- | --- | --- |
| home | ~/.porcelain | yes | mixed |
| userData | ~/.local/share/porcelain | yes | material |
| repoCompanion | <repo>/.porcelain | no | material |

## Manual procedure

Stop the production daemon on port 43117 first.

If they exist, remove only the production home (`~/.porcelain`) and the production userData root (`~/.local/share/porcelain`). That removal is irreversible: every classified record under those roots is lost, and no archive exists.

Remove a checkout companion (`<repo>/.porcelain`) only when you, the owner, decide a launch cutover requires a blank companion. Otherwise leave that directory as the permanent persistence model.

Never point this procedure at the development home (`~/.porcelain-dev`) or the development userData root (`~/.local/share/porcelain-dev`).

Never ask an agent, a CI job, or a pnpm script to perform those removals.
