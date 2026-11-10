---
route: /settings/$section
selectors:
  - 'Default walkthrough writer'
  - 'Walkthrough settings'
  - 'Walkthrough writer'
  - 'Walkthrough effort'
  - 'Walkthrough mode'
  - 'Save'
tests:
  - apps/server/spec/integration/walkthrough-settings.integration.ts
  - apps/server/spec/integration/walkthroughs-restart.integration.ts
  - packages/agents/src/walkthrough-writing/installed-walkthrough-model-reader.spec.ts
  - apps/web/spec/integration/projects-rename.test.tsx
  - packages/client/src/features/projects/rules/walkthrough-writer.spec.ts
api:
  - GET /api/walkthrough-settings
  - PUT /api/walkthrough-settings
  - PUT /api/projects/:projectId/walkthrough-settings
  - GET /api/inventory
---

# projects.walkthrough-settings

The server-wide writer is in Settings → Changes & Git. It includes provider/model and the effort levels supported by that model. The note explains project overrides. Sidebar project actions → Walkthrough settings opens one small dialog with the default as its first writer option, any project override, effort, and Manual / Automatic. No other sidebar sections are added. The built-in writer is Claude Opus 5.5 at high effort; manual and automatic starts resolve an explicit request, project override, saved default, then built-in, in that order.

## How to get to it

Open Settings → Changes & Git → Default walkthrough writer, or use a project's existing three-dot menu → Walkthrough settings. Close or Escape dismisses the dialog. Save closes the project dialog; the global default remains on the settings page.

## Driving it with browser

Start one disposable instance with `start --coding-tool` for signed-in fixture Claude discovery. Without the fake tool the empty installed-model list is intentional. Open default settings, choose Sonnet and medium effort, save and reload. Read `/api/walkthrough-settings` independently. Capture the settings page with its note.

Open the project menu and capture it, then open Walkthrough settings. The first option says Use the default and shows the current provider/model/effort. Save Automatic without overriding the writer; `/api/inventory` must contain mode automatic with no writer override. Change the global default, reopen the project dialog, and confirm its default option follows the new value. Select Opus 5.5 and a supported effort as an override, save and reopen; the explicit override remains. Return to Use the default and Manual. Capture the dialog. Model choices include only installed signed-in providers; Codex uses CODEX_HOME model metadata and its per-model effort list. A saved model that disappears remains visibly unavailable and is never silently substituted.

## Gotchas

The fake coding tool authenticates locally and drafts commits; it does not write a real walkthrough. Writer process flags, two-pass effort and unavailable-model failures are covered by the named adapter and server tests. This loopback journey does not establish native mobile/desktop or remote connectivity. Mobile consumes the shared client API; its views are owned separately.

A project with a saved unavailable writer still shows the unavailable warning. Changing Automatic to Manual must leave Save enabled when provider, model and effort are unchanged; save and independently read inventory to confirm Manual with the same override. A different unavailable writer or effort remains unsavable.

The default writer uses the same outlined setting row as Spec files and Pull strategy, with its description beside the controls. Changes & Git describes change grouping, walkthrough writers, GitHub accounts, pull and archive; its shared-computer notice names Changes & Git.
