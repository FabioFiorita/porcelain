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
  - GET /api/projects/:projectId/pull-requests/:number
  - POST /api/projects/:projectId/pull-requests/:number/archive
---

# reviews.pull-request

A PR number opens a native read-only document scoped to its project, number and computer. Description, checks and the GitHub conversation use the native Markdown renderer.

From Worktrees tap a PR number, or open the current worktree's Pull request row. The existing checkout stays selected. Read title, state, branches, description, checks and threaded GitHub replies. Open on GitHub is the explicit external action. Back restores the list and its search and filters.

Repeat with the same PR number on two computers. The document reads from the chosen computer. Verify loading, missing PR, rate limit and disconnected states, then retry after recovery. A merged or closed PR offers Archive; follow [archive](projects.archive-pull-request.md). There are no saved review, worktree comment or draft routes.

Verify an Android phone and a tablet in landscape and portrait. Report iOS proof separately.

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
