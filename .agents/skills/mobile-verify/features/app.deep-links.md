---
screen: /open/reviews/[reviewId]
selectors:
  - 'Review'
  - 'Files'
  - 'History'
  - 'Settings'
  - 'Pair this computer'
  - 'All decisions'
  - 'Select a worktree to continue.'
  - 'No computers paired.'
tests:
  - packages/client/src/features/reviews/rules/app-link.spec.ts
  - packages/client/src/features/projects/commands/selection.spec.ts
api:
  - GET /api/environment
  - GET /api/session
---

# app.deep-links

Development scheme and public HTTPS links open the requested destination through warm launch, cold launch and pairing.

## How to get to it (user POV)

- `porcelain.dev://` (Files), `://files`, `://review`, `://history`, `://settings`; use the full scheme for each.
- Public HTTPS `/open/reviews/<reviewId>` with environment, host, protocol (http or https) and optional revision/decision.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open `porcelain.dev://history`, `porcelain.dev://settings`, `porcelain.dev://` and `porcelain.dev://review`. Expect History, Settings, Files and Review respectively, with the matching selected tab/sidebar. In Settings open Computers and confirm pairing. Cold-launch into History and confirm that destination.
2. Publish a committed review through the fixture CLI. Deliver `/open/reviews/<reviewId>?environment=<environmentId>&host=<host>` with `protocol=http` for the local listener (or `https` for remote HTTPS), and optional `revision` and `decision`. On Android use a VIEW intent targeting the disposable development package, warm and cold. With another environment selected, expect the linked computer/review; independently read saved selection and seen revision.
3. Unpaired, open a decision link → Pair this computer → pair that computer. The exact review/decision opens without resending the link. Cancel preserves the destination and pairing offer; native header Back exits to Review.
4. Try missing review/revision/decision, offline computer and a host containing a scheme/path. Expect explanation and Back; connectivity failures offer Read again. A missing decision leaves the verdict/list usable. Return to the existing workspace Review and confirm it still opens.

Automated coverage: `app-link.spec.ts`, `selection.spec.ts`.

## Gotchas

- Apply the shared development-link flags and accept iOS open-link prompts. Pair/select a worktree before routes that require them.
- Associated domains/intent filters require a matching native build. Explicit Android package routing does not prove automatic domain verification; physical iPhone association requires its Preview binary and deployed hub files. Android signing fingerprints remain placeholders until distribution.
- Debug cold HTTPS intents can stop at Expo DevLauncherActivity before routing. Report that boundary; a separate release-mode development APK can test cold routing, but its HTTP reads may hit Android cleartext policy (#424). Restore the normal debug client afterward.
- Browser fallback needs the hub rewrite and explicit navigation button. Simulator, local-intent and physical association proof are separate.
