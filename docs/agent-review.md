# Agent review handoff

Porcelain exposes Streamable HTTP MCP at `/mcp` (also `/api/mcp`) on the running
server. Configure the coding agent's MCP client with that URL and an
`Authorization: Bearer <Porcelain access token>` header. Use its secret/environment
setting for the token. Browser-session cookies are not accepted here.

An agent finds the registered worktree with `inventory`, reads current layers and
revision with `read_layers`, then publishes ordered layers with `replace_layers`.
Keep summaries and file notes short. `publish_artifact` accepts `handoff.md` for the
code-facing summary and verification, and `handoff.html` for a readable report.

Use `review_evidence` or `read_file` for the fingerprints used by anchored comments.
`list_comments`, `create_comment`, `reply_to_comment`, and `resolve_comment` share
threads with the web app. MCP messages are attributed to the agent; HTTP messages
to the reviewer. Nothing is pushed to coding sessions: ask the agent to read and
address your comments when ready.
