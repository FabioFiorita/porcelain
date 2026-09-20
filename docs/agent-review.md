# Agent review handoff

Porcelain serves MCP over its owner socket, not the network, and `porcelain mcp` bridges an
agent's stdio to it. Configure the coding agent with that command, for example:

```sh
claude mcp add porcelain -- porcelain mcp
```

There is no credential to configure. Reaching the socket means passing the data directory's
permissions, which is the authority you already have at that terminal — so an agent on this
machine needs no secret, and nothing off it can reach the agent tools at all.

An agent finds the registered worktree with `inventory`, reads current layers and
revision with `read_layers`, then publishes ordered layers with `replace_layers`.
Keep summaries and file notes short. `publish_artifact` accepts `handoff.md` for the
code-facing summary and verification, and `handoff.html` for a readable report.

Use `review_evidence` or `read_file` for the fingerprints used by anchored comments.
`list_comments`, `create_comment`, `reply_to_comment`, and `resolve_comment` share
threads with the web app. MCP messages are attributed to the agent; HTTP messages
to the reviewer. Nothing is pushed to coding sessions: ask the agent to read and
address your comments when ready.
