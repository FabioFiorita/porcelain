# @porcelain/client-runtime

Non-UI client behavior shared by web and mobile. Subpath exports only — no root barrel.

| Subpath | Responsibility |
|---------|----------------|
| `./commit-message` | Conventional-commit `type(scope):` prefix parse / rewrite |
| `./highlight` | Shiki grammars/themes, language lookup, hunk + line tokenization |
| `./paths` | Repo-relative basename / dirname helpers |
| `./terminal-keys` | PTY edit chords, Ctrl bytes, arrow DECCKM |
| `./session/transport` | WS URL/subprotocol and reconnect backoff helpers |
| `./session/client-runtime` | Hello/ready, recovery, watches, terminal frame delivery |
| `./session/recovery` | Epoch/sequence freshness requirements |
| `./session/interests` | Bounded declarative file/dir interests |
| `./word-diff-line` | Desktop/GitHub-Desktop-style prefix/suffix line emphasis |
| `./word-diff-tokens` | Token LCS ranges for the native row canvas |

Two word-diff algorithms are intentional: web paints syntax spans; mobile paints
canvas ranges. Shared session runtime so reconnect semantics cannot drift.

Platform apps still own full session lifecycle, env storage, and UI navigation.
Contracts holds wire shapes; this package holds client-side pure logic.
