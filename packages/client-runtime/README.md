# @porcelain/client-runtime

Non-UI client behavior shared by web and mobile. Subpath exports only — no root barrel.

| Subpath | Responsibility |
|---------|----------------|
| `./terminal-keys` | PTY edit chords, Ctrl bytes, arrow DECCKM |

Session protocol, env failover pure core, and word-diff will land here as forks are deleted.
Contracts holds wire shapes; this package holds client-side pure logic.

Platform apps supply persistence and UI navigation themselves.
