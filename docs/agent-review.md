# Publishing a review from an agent

Porcelain serves MCP over its local owner socket. `porcelain mcp` bridges an agent's stdio to it:

```sh
claude mcp add porcelain -- porcelain mcp
```

Start the agent in the registered checkout. The bridge supplies its working directory; tools can
also target another registered checkout explicitly. No separate agent credential is needed:
access to the private owner socket is the authority.

Read the `porcelain://review-guide` MCP resource for publishing instructions and examples. Use the
agent's own filesystem and Git tools to inspect code. Publish the summary and behavior layers as
one review, using the revision returned by `read_review` to protect against overwriting newer work.

Comments are shared with the web app. MCP messages are attributed to the agent; browser messages
to the reviewer. Nothing is pushed into coding sessions: ask the agent to read and address comments
when ready.
