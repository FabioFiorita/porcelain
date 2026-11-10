---
screen: /open/reviews/[reviewId]
selectors:
  - 'Reviews'
  - 'Worktrees'
  - 'Review'
  - 'Files'
  - 'History'
  - 'Settings'
  - 'Pair this computer'
  - 'Back'
  - 'Select a worktree'
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

- `porcelain.dev://` (Reviews), `://worktrees`, `://files`, `://review`, `://history`, `://settings`; use the full scheme for each. A shared screen opened cold lands in the Reviews tab.
- Public HTTPS `/open/reviews/<reviewId>` with environment, host, protocol (http or https) and optional revision/decision.
- Public HTTPS `/open/pair#…` pairing links: follow [pairing link](access.pairing-link.md).

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open `porcelain.dev://history`, `porcelain.dev://settings`, `porcelain.dev://`, `porcelain.dev://worktrees` and `porcelain.dev://review`. Expect History (pushed in the Reviews tab, with Back), the Settings modal, the Reviews inbox, the Worktrees tab and Review respectively. Without a selected worktree, History/Review/Files show Select a worktree. In Settings open Computers and confirm pairing. Cold-launch into History and confirm that destination and that Back reaches Reviews. A file link for the selected worktree pushes the file on phones and narrow tablets and opens beside the Files tree in Worktrees on a wide tablet ([preview](files.preview.md) step 10).
2. Publish a committed review through the fixture CLI. Deliver `/open/reviews/<reviewId>?environment=<environmentId>&host=<host>` with `protocol=http` for the local listener (or `https` for remote HTTPS), and optional `revision` and `decision`. On Android use a VIEW intent targeting the disposable development package, warm and cold. With another environment selected, expect the linked computer/review; independently read saved selection and seen revision.
3. Unpaired, open a decision link → Pair this computer → pair that computer. The exact review/decision opens without resending the link. Cancel preserves the destination and pairing offer; native header Back exits to the Reviews inbox.
4. Try missing review/revision/decision, offline computer and a host containing a scheme/path. Expect explanation and Back; connectivity failures offer Read again. A missing decision leaves the verdict/list usable. Open the selected worktree's Review from Worktrees and confirm it still opens.
5. On a tablet, open an exact-revision review link in landscape and in portrait. The native header exposes Back; Back returns to the Reviews inbox, including a cold link with no prior destination. Repeat the return on a phone; Back from a decision opened inside the review returns to that review.

Automated coverage: `app-link.spec.ts`, `selection.spec.ts`.

## Gotchas

- Apply the shared development-link flags and accept iOS open-link prompts. Pair/select a worktree before routes that require them.
- Associated domains/intent filters require a matching native build. Explicit Android package routing does not prove automatic domain verification; physical iPhone association requires its Preview binary and deployed hub files. Android signing fingerprints remain placeholders until distribution.
- Debug cold HTTPS intents can stop at Expo DevLauncherActivity before routing. Report that boundary; a separate release-mode development APK can test cold routing, but its HTTP reads may hit Android cleartext policy (#424). Restore the normal debug client afterward.
- Expo development clients require the project to be open for app-specific links. On iOS, use an isolated Release-configuration Porcelain Dev with embedded JavaScript for a cold app-link check, then restore the matching development client. Opening Metro first and then delivering the link proves warm delivery only.
- Browser fallback needs the hub rewrite and explicit navigation button. Simulator, local-intent and physical association proof are separate.
