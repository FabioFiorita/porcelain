# Agent review handoff

Porcelain exposes Streamable HTTP MCP at `/mcp` (also `/api/mcp`) on the running
server. Configure the coding agent's MCP client with that URL and an
`Authorization: Bearer <Porcelain access token>` header. Use its secret/environment
setting for the token. Browser-session cookies are not accepted here.

Find the registered worktree with `inventory`, read its current layers and revision
with `read_layers`, then publish through `replace_layers`. Preserve unrelated layers
and reconcile revision conflicts. Keep summaries and file notes short.

## Guided layers

For a behavior that spans files, add an optional `guide` to its layer. Use a short
`purpose` and ordered `steps`. Each step has a stable UUID `id`, `title`, `question`
and `source`. Read that source with `read_file` first, then copy its exact
`contentFingerprint` and a one-based inclusive `startLine`/`endLine`. Never invent a
fingerprint or use the different fingerprint returned by `review_evidence`.

A source references current-worktree text, not the index or a commit. Unchanged
files and files assigned to another layer can be context without adding them to
`files`. Keep `files` as the changed-file inventory. Optional `related` entries each
have a `title` and `source`; they connect callers, state owners and relevant tests.
Keep references distinct within a step and preserve step IDs when editing the guide.

Optional `note` explains a consequential decision. Optional `verification` contains
manual reproduction steps, test references and clearly attributed results or gaps.
These are agent claims, not Porcelain's attestation that tests pass. Prefer the
question a reviewer needs to answer over a retelling of the session or filenames.

The reviewer opens the guide first and can return to all layer files. Visiting
steps does not mark code reviewed. Republish stale references only after inspecting
the updated code. See [guided review boundaries](decisions/guided-review.md).

`publish_artifact` accepts `handoff.md` for a short overview and verification, and
`handoff.html` for an optional visual report. Do not duplicate the guide in a long
handoff.

Use `review_evidence` or `read_file` for the appropriate fingerprints in anchored
comments. `list_comments`, `create_comment`, `reply_to_comment`, and
`resolve_comment` share threads with the web app. MCP messages are attributed to
the agent; HTTP messages to the reviewer. Nothing is pushed to coding sessions:
ask the agent to read and address comments when ready.
