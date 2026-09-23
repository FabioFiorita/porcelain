# Project removal

Status: existing server behavior, mapped for the first isolated check.

## Purpose and path

The paired owner can remove one registered project. The route validates a UUID path parameter and passes it to the removal controller. The controller admits one project write, calls the removal service, forgets the deleted project from the worktree directory, and publishes an inventory change when deletion succeeds. The service calls its focused removal port; storage deletes the project's dependent records in one transaction.

The CLI starts a fresh isolated server with one registered Git repository, pairs a client, reads the actual project ID from `GET /api/inventory`, sends `DELETE /api/projects/:projectId`, and reads inventory again. It never uses a hard-coded fixture ID.

## Behavior to verify

| Case | Request | Expected response | Observable state |
| --- | --- | --- | --- |
| Invalid ID | A non-UUID path parameter | `400`, rejected request | Inventory unchanged. |
| Unknown project | A valid UUID absent from inventory | `200`, `{ "deleted": false }` | Inventory unchanged. |
| Existing project | The registered project's ID | `200`, `{ "deleted": true }` | Project absent from inventory. |
| Already removed | Repeat deletion of the same ID | `200`, `{ "deleted": false }` | Inventory remains empty. |

Each case records redacted request details, response status and body, before and after inventory, server logs, and assertion results. Setup failure or zero assertions fails verification.

## Executable check and limits

Run `node .agents/skills/server-verify/scripts/verify.ts projects.remove` and read its evidence file. The first check does not assert database rows individually, a restart, or the live update notification; those need additional observations and cases.

## Current code locations

- Route: `apps/server/src/http/routes/projects/remove.ts`
- Contract: `packages/contracts/src/projects/inventory.ts`
- Controller: `apps/server/src/controllers/remove-project-controller.ts`
- Service and port: `packages/projects/src/services/remove-project-service.ts`, `packages/projects/src/ports/project-removal-store.ts`
- Storage: `packages/storage/src/repositories/projects/project-removal-repository.ts`
