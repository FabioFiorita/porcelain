---
route: /reviews/history/$projectId
selectors:
  - 'Project history'
  - 'How this project is growing'
  - 'Back to Reviews'
tests:
  - apps/web/spec/integration/reviews-page.test.tsx
api:
  - GET /api/projects/:projectId/reviews
---

Open Project history under a project's Reviews heading. Each retained review appears oldest first, showing added, changed and removed owners and guards added from its saved import snapshot. Older reviews without a graph say it is unavailable. Open a review and return through the project heading. Repeat at 1440 and 414, light and dark, after publishing a second revision and after removing a checkout. A disconnected remote must not silently show the local project's history.

Automated coverage: `reviews-page.test.tsx`.
