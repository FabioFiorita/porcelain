# Project rename

Status: approved feature behavior. The CLI checks every case in the table; the invalid-name case includes empty, whitespace-only, overlong, and control-character names.

## Purpose

The owner can give a registered project a new display name without changing the project's identity, worktrees, or other projects.

## Reach the feature

- Start a fresh isolated server with a temporary Git repository registered as one project.
- Pair a client and keep its credential private to that isolated session.
- Read `GET /api/inventory` with the paired credential to discover the project's actual ID and capture its initial state.
- Send `PATCH /api/projects/:projectId` with JSON `{ "name": "..." }` and the same credential.
- Read `GET /api/inventory` again to observe the result.

The fixture must discover the ID from the server. It must not rely on a hard-coded UUID or the temporary repository's folder name.

## Behavior to verify

| Case | Request | Expected response | Observable state |
| --- | --- | --- | --- |
| Existing project | A registered project's ID and `"  New name  "` | `200`, same ID, name `"New name"` | Inventory has that project with the new name; its ID and worktrees are unchanged; other projects are unchanged. |
| Unknown project | A valid UUID absent from inventory and a valid name | `404`, `{ statusCode: 404, error: 'Not Found', message: 'Project not found' }` | Inventory is unchanged. |
| Invalid name | Empty or whitespace-only name, more than 100 characters, or a control character | `400`, `{ statusCode: 400, error: 'Bad Request', message: 'Invalid request' }` | Inventory is unchanged. |
| Invalid ID | A value that is not a UUID and a valid name | `400`, `{ statusCode: 400, error: 'Bad Request', message: 'Invalid request' }` | Inventory is unchanged. |

For every case, capture the actual request (with credentials redacted), response status and body, inventory before and after, server logs, and each assertion's result. A failed setup or zero executed assertions is a failed verification.

## Executable check

Run every case in the table through the real HTTP server in an isolated session with `node .agents/skills/server-verify/scripts/verify.ts projects.rename`. Read the evidence path printed by the command.

## Scope decisions

- Duplicate display names are allowed; the first CLI check makes no assertion about them.
- Restart persistence and inventory-change notification checks are deferred. Both require observations beyond the first request and inventory read.

## Current code locations

- HTTP route: `apps/server/src/http/routes/projects/rename.ts`
- Request and response contracts: `packages/contracts/src/projects/inventory.ts`
- Controller: `apps/server/src/controllers/rename-project-controller.ts`
- Business operation: `packages/projects/src/services/rename-project-service.ts`
- Persistence: `packages/storage/src/repositories/projects/inventory-repository.ts`
- Isolated fixture setup: `scripts/dev-server.ts` and `scripts/dev-server-child.ts`
