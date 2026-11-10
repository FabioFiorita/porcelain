# Durable walkthrough writing

The contract is `packages/contracts/src/walkthroughs/api.ts`. The writing routes require the paired fixture credential and its Origin.

1. Commit a small fixture change on a branch and keep its base branch. POST `/api/worktrees/:worktreeId/walkthrough` with `{ "base": "refs/heads/main" }`. The response is the durable run, initially queued. Repeat the same request while the attempt is queued, running or ready: the id must match and no second writer may start. After a failed attempt, an explicit start creates a new attempt; concurrent presses share that new attempt. Earlier failures remain stored.
2. GET the same path to observe the latest attempt, running then ready content or a failed state with a plain message. Subscribe to the worktree live channel: changes use `type: "walkthrough", change: "run"`.
3. Make a new commit. GET reports `outOfDate: true`; the retained walkthrough keeps its original base/head. Starting at the new head queues a new run.
4. Existing PR evidence is addressed by GET `/api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId`; verify its media type and exact bytes. A missing asset or an asset belonging to another run returns the declared 404 JSON error, `Walkthrough evidence asset not found`. No PR means no PR evidence.
5. PR attachment images may redirect: follow at most five HTTPS redirects, checking every destination against the GitHub image allowlist before requesting it. The public attachment chain from GitHub to `github-production-user-asset-6210df.s3.amazonaws.com` is allowed; unrelated S3 buckets and lookalike hosts must never be fetched.
6. Both writer passes exclude inherited MCP/plugin tools and repository hooks. Before each Codex pass, list effective MCP servers, explicitly disable each name, and read the effective list with those overrides; fail without starting the writer if either list is unreadable or any server remains enabled, including one forced on by managed settings. Codex progress is separate from the final answer file; prose progress must not reject valid final output.
7. Stop and reopen the application with the same disposable database while a writer is active. Running work becomes failed with an interruption message, queued work is dispatched, finished content and evidence remain readable. Shutdown drains the writer process group before persistence closes.

Run `apps/server/spec/integration/walkthroughs.integration.ts` and `apps/server/spec/integration/walkthroughs-restart.integration.ts` through the integration runner, then `apps/server/src/runtime/walkthrough-workflow.spec.ts`, `apps/server/src/adapters/walkthroughs/filesystem-transcript-reader.spec.ts`, `apps/server/src/adapters/walkthroughs/github-evidence-reader.spec.ts`, `packages/agents/src/walkthrough-writing/cli-walkthrough-writer.spec.ts`, `packages/walkthroughs/src/rules/qualify-walkthrough.spec.ts` and `packages/storage/src/db/migrate.spec.ts` by name. They use fake CLI executables, real SQLite and real Git for durable execution, filtering and qualification.

The default sandbox intentionally has no installed agent, sign-in or network. A real writer proof needs the host CLI through a bounded, owned verification bridge, using a public Porcelain change and the same read-only flags. Retain timing and cost from the ready state; never copy transcripts or credentials to evidence.

The walkthrough integration spec uses the built server and real SQLite, reaches all three walkthrough routes with valid credentials, and passes their actual validated-handler log through the unchanged route-coverage guard. This focused check establishes coverage of these routes; the global teardown guard is judged only by a full integration run.

## Configuration execution audit

Checked Codex 0.167.0 against its [configuration reference](https://developers.openai.com/codex/config-reference) and [matching source](https://github.com/openai/codex/tree/rust-v0.167.0/codex-rs), and Claude Code 2.1.321 against its installed source and [settings reference](https://code.claude.com/docs/en/settings-reference). Recheck this list when changing CLI versions or launch settings.

| Surface | Control on both passes |
| --- | --- |
| Codex `notify` | `notify=[]` and `--ignore-user-config`; a configured external notifier must never run. |
| Codex lifecycle hooks, plugin hooks and exec rules | User config and user/project rules are ignored; `features.hooks=false`, plugins, apps, both multi-agent variants and skill MCP dependency installation are disabled. |
| Codex provider bearer-token commands, AWS refresh/export and GCP command authentication | Provider declarations from user config are ignored. Native sign-in storage stays at the original `CODEX_HOME`. |
| Codex credential-store selection | Read only the top-level `cli_auth_credentials_store` from the user's TOML, validate `file`, `keyring` or `auto`, and explicitly preserve it on both passes. Missing or invalid values are ignored; the rest of user config remains isolated. |
| Codex shell snapshots, profile capture and login shells | Both snapshot features, profile capture and login shells are off; the process has an isolated home. |
| Codex user environment/SSH execution configuration | `exec --ignore-user-config` selects the environment-only loader instead of loading user-owned environment definitions. |
| Codex stdio/HTTP MCP, plugin MCP and HTTP header helpers | Discover and explicitly disable every server, retaining only the required transport field so ignoring user config cannot create an invalid transport. Verify effective disablement before each pass. Auth-status discovery does not execute HTTP header helpers. An enabled managed MCP server fails closed. |
| Codex browser, computer, image generation and web tools | Explicitly disabled, alongside apps, plugins and multi-agent tools. |
| Codex TUI status rows, external editor/file opener and old undo snapshots | Status rows are data; editor/file opener entry points are interactive, not `exec`; the undo snapshot feature is removed in 0.167.0. |
| Claude hooks, status lines, subagent status lines and file suggestions | Empty setting sources, safe mode and `disableAllHooks` exclude user/repository commands. |
| Claude API-key/proxy helpers, AWS refresh/export, GCP refresh and telemetry-header helpers | User/repository settings are not loaded. The original `CLAUDE_CONFIG_DIR` preserves sign-in and session storage. |
| Claude plugin command sources, marketplace/header helpers, LSP servers, monitors, skills and workflows | Safe mode, empty setting sources and disabled slash commands exclude inherited user/repository customizations; strict empty MCP config excludes their model-callable servers. Only Read, Grep, Glob and restricted Git Bash tools are exposed. |
| Shell startup and launch wrappers | An isolated home and `ZDOTDIR` prevent user profile discovery. `BASH_ENV`, `ENV`, Claude shell/prefix/plugin-directory/process-wrapper settings and Node/Bun preload options are cleared. Worktree cwd and pinned commit range are unchanged. |

Administrator-enforced hooks and callbacks are trusted; user/repository command configuration is isolated, and model-callable MCP servers that cannot be disabled cause the walkthrough to fail.

## Walkthrough conversations

The contract is `packages/contracts/src/walkthroughs/conversations.ts`. Every route needs the paired credential and the Origin, under `/api/worktrees/:worktreeId/walkthrough/conversations`.

1. A walkthrough must be finished (`status: "ready"`). POST `.../messages` with `{ "runId": "<id>", "anchor": { "kind": "walkthrough" } | { "kind": "stop", "title": "<exact stop title>" }, "text": "Why?" }`. The response is the conversation view with the developer message and its agent reply in state `answering`. An unknown stop, an unfinished run or a run from another worktree answers 404.
2. GET `.../conversations` for the view: `runId` is the latest finished run and each conversation keeps the run it was made on. After a newer finished run, a stop whose title still exists keeps its anchor and the rest appear under `kind: "walkthrough"`. No conversation is deleted by a new commit or walkthrough.
3. Answers run in the walkthrough serial queue. A live notice `type: "walkthrough", change: "conversations"` follows a message, an answer, a retry, a save and a post. POST `.../messages/:messageId/retry` re-queues only a failed answer.
4. PUT `.../messages/:messageId/saved` with `{ "saved": true | false }`. POST `.../messages/:messageId/post` posts one message; POST `.../post-saved` posts every saved message as one comment. With a pull request on the latest finished run the outcome is `{ "status": "posted", "url": "..." }`, without one `{ "status": "brief", "text": "..." }`; nothing saved is `{ "status": "nothing" }`. Posting one message again returns the same URL and posts nothing; posting saved again finds nothing saved and answers `nothing`. GET `.../brief[?messageId=...]` reads the same text. A start with a pull request records the GitHub repository from `origin`; posting goes only there, and when `origin` no longer matches it, posting answers 409 and posts nothing, while the brief stays readable. A message posts only when its own run recorded the same repository; `post-saved` posts the eligible ones and lists the rest in `notPosted`, and refuses with 409 when none are eligible.
5. On restart, answers still answering become failed with `This answer was interrupted. Ask again.`

Run `apps/server/spec/integration/walkthroughs.integration.ts` (fake agent and fake `gh`, real SQLite) and the auth sweep through the integration runner, then `apps/server/src/runtime/walkthrough-answers.spec.ts`, `apps/server/src/use-cases/walkthroughs/post-walkthrough-messages.spec.ts`, `packages/walkthroughs/src/rules/conversations.spec.ts`, `packages/agents/src/walkthrough-writing/cli-walkthrough-writer.spec.ts` and `packages/client/src/features/walkthroughs` by name.

A real answer needs the host's installed CLI through a bounded, owned bridge (the sandbox has no agent, sign-in or network), on a public Porcelain change with no pull request, so posting cannot reach GitHub. Report the answered state's `durationMs` and `costUsd`. Never post to a real pull request as a test: the post path is verified against a fake `gh`.
