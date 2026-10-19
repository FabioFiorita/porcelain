---
screen: /open/reviews/[reviewId]
selectors:
  - "Review"
  - "Files"
  - "History"
  - "Settings"
  - "Back to Review"
  - "Pair this computer"
  - "All decisions"
  - "Select a worktree to continue."
  - "No environments paired."
tests:
  - packages/client/src/features/reviews/rules/app-link.spec.ts
  - packages/client/src/features/projects/commands/selection.spec.ts
api:
  - GET /api/environment
  - GET /api/session
---

# app.deep-links

## What it is

Expo Router opens each screen from the app's scheme, `porcelain.dev://` for the development identity: `porcelain.dev://` and `porcelain.dev://files` for Files, `porcelain.dev://review` for Review, `porcelain.dev://history` and `porcelain.dev://settings`, with the matching tab or sidebar row selected, whether the app is running or was cold-launched. Use these links to reach view states during on-demand mobile verification.

## How a user reaches it

- any link with the app's scheme, or `xcrun simctl openurl`

## Driving it

1. Open porcelain.dev://history in the development client. Expect History and the matching selected tab or sidebar row.
2. Open porcelain.dev://settings. Expect Settings and the paired environment.
3. Repeat with porcelain.dev:// and porcelain.dev://review. Expect Files and Review respectively.
4. Cold-launch using the History link. Expect History directly, with the matching native selection.
5. Accept an iOS open-link confirmation when it appears. Keep the development-menu flags from references/driving.md on links.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- Only screens have links. Pairing and choosing a worktree have none, so a test that needs a paired environment or a selected worktree walks those steps first.
- iOS asks to confirm opening a link from outside the app; the flows and the CLI accept it.

## Public review links

The HTTPS hub route `/open/reviews/<reviewId>?environment=<environmentId>&host=<host>`
is an Expo Router screen inside the existing Review stack. It needs no native
intent rewriting. Optional `revision` reads an immutable publication; optional
`decision` opens that decision, including in the latest revision when no number
was supplied. The saved destination stays in the route through pairing.

1. Build the development binary first: associated domains and intent filters are
   native configuration. Start one disposable mobile-verify instance and publish
   a committed review through its fixture CLI.
2. Deliver the hub URL with an Android VIEW intent, cold and warm. Since the
   public association deliberately covers Preview and Production, use the explicit
   disposable development package for local routing proof. Do not report that as
   automatic domain verification.
3. With another environment selected, open a link for the fixture environment.
   Expect the matching computer and review, and independently read the saved
   environment selection and server seen revision. Existing workspace choices
   must remain intact.
4. With no paired environment, open a decision link. Select Pair this computer,
   fill the pairing form for that environment, and pair. Expect the same review
   and decision without opening the link again. Cancel leaves the destination
   and offers pairing again; Back to Review exits.
5. Try a missing review, revision and decision, an offline computer, and a host
   containing a scheme or path. Expect an explanatory state and a way back;
   connectivity failures offer Read again. A missing decision leaves the verdict
   and decisions available.
6. Return to the existing Review tab and confirm its workspace review still opens.

The marketing browser fallback requires its Cloudflare Pages rewrite; it validates
in the browser and only navigates after pressing the button. Association files
contain named signing placeholders until the owner supplies the Team ID and
Preview/Production fingerprints. Physical iPhone association requires the new
Preview binary and deployed hub files. Android local intent proof, iOS simulator
proof and physical-device domain association are distinct results.

## Cold-start proof boundary

An HTTPS cold intent to the debug development client is intercepted by Expo's
DevLauncherActivity before Expo Router loads. For U6, a one-off local release-mode
APK kept the Porcelain Dev identity and reached MainActivity and the review route
on cold start. Its HTTP fixture read showed the recoverable connection state:
Android release cleartext policy is tracked separately in #424. Warm content,
pairing and decisions were proved under the normal development client. A permanent
standalone cold-start command is a verification-skill follow-up; no launcher or
build-script change is part of U6. Restore the normal debug client or leave the
emulator shut down after this one-off proof.
