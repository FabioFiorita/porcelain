---
screen: /pull-request
selectors:
  - 'PR #'
  - 'Read pull request again'
  - 'Open on GitHub'
  - 'Reading pull request…'
  - 'Archive'
tests:
  - apps/mobile/src/shared/rules/markdown.spec.ts
  - apps/mobile/src/features/workspace/rules/pull-request-document.spec.ts
api:
  - GET /api/reviews/:reviewId/pull-request
  - POST /api/reviews/:reviewId/archive
---

# reviews.pull-request

PR numbers open a read-only native document scoped to their review and computer, while preserving the selected checkout. Description, checks and threaded conversation use the native Markdown renderer.

## How to get to it (user POV)

- Worktrees → a linked review’s PR # action, or the #n top-bar action on a worktree's Changes (Open pull request #n).
- Published review → Open pull request.

## Driving it with agent-device

Preconditions: [surface baseline](README.md), with a review linked to a disposable GitHub fixture. Include a Markdown description, checks, comments, a review with threaded code replies, and incomplete-data flags.

1. Keep checkout A selected. In Worktrees tap a PR # on computer B: the Worktrees stack displays PR #number with an opaque header and Back, on phones and tablets. Independently read selection storage: checkout A and its computer remain selected.
2. Read title, state, branches, review-head relationship, description, checks and conversation; nested replies and diff hunks remain present. Check incomplete checks/conversation disclosures, no description, no conversation, long Markdown, dark/light and larger text. Open on GitHub is the explicit external action; the PR number itself stays in the app.
3. Back returns to the Worktrees list with the same search/filters/selection. Repeat from the Worktree page's #n top-bar action, from a published review's Open pull request (Reviews tab), and with identical PR/review numbers on two computers. The document uses the chosen computer, never the selected checkout’s connection.
4. Leave an unsent draft before opening the PR. The additive PR visit requires no discard: return to the original document and reopen its comments to find the exact body, original anchor/review revision and retry identity. Repeat on a tablet in landscape and portrait. Closing a dirty document or changing its target still asks before discarding. The read-only PR document itself has no unlink or write controls.
5. Delay/fail the PR read, return not-linked, or disconnect the computer: loading/failure has a usable return path and Read pull request again when connected. Retry after recovery. A GitHub missing-PR error or null PR response says GitHub could not find the pull request, distinct from offline/rate-limit/access failures. The review stays linked and readable; retry can recover without relinking. Check this from the published-review PR state as well as the PR document. Change the review’s linked PR number while the old document is open: the old document explains that it changed and directs the developer back to Worktrees rather than showing a different PR under the old number.
6. For a successfully read merged/closed PR, Archive opens the guarded preview sheet with confirmed computer settings. Follow [archive](projects.archive-review.md), close it first, then verify the actual fixture changes independently.

## Gotchas

- PR payload reads start on document opening; the Worktrees list and project expansion do not fetch them. Changing route/document never selects a checkout or computer.
- Verify shared tablet layout and return paths on an Android tablet in landscape and portrait, with separate captures. Changes to iOS-native navigation or presentation also need iPad proof; report that separately.

## Description evidence

Seed the disposable GitHub fixture's PR description with an Evidence heading, a
`details` block whose `summary` says Screenshots, an HTML `img` and a Markdown
image using GitHub user-attachment URLs. Include one unreachable image with a
meaningful alt label and one image with an unsafe URL scheme.

Open the linked PR document and scroll to Description. Mobile presents disclosure
contents expanded with their summary as readable text. Neither details/summary
nor unsupported HTML tags appear as raw text. Both image syntaxes fit the content
width and preserve aspect ratio. An unavailable or rejected image shows compact
Image unavailable text with its alt label. Switch to Show source to inspect the
original body and back to Show rendered, then return to the review. Repeat with
light and dark appearance. Capture the same Description view before and after the
fix on a matching native build; JavaScript-only refresh cannot qualify changes to
the native image renderer. iOS and Android require separate runtime evidence.
