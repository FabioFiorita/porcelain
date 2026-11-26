---
route: /settings/$section
selectors:
  - 'Default walkthrough writer'
  - 'Walkthrough settings'
  - 'Project walkthrough settings'
  - 'Walkthrough writer'
  - 'Walkthrough effort'
  - 'Walkthrough mode'
  - 'No writers available'
  - 'Check again'
  - 'Save'
tests:
  - apps/server/spec/integration/walkthrough-settings.integration.ts
  - apps/server/spec/integration/walkthroughs-restart.integration.ts
  - packages/agents/src/walkthrough-writing/installed-walkthrough-model-reader.spec.ts
  - apps/web/spec/integration/projects-rename.test.tsx
  - packages/client/src/features/projects/rules/walkthrough-writer.spec.ts
  - apps/web/spec/integration/walkthrough-writer-availability.test.tsx
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

Start one disposable instance with `start --coding-tool` for signed-in fixture Claude discovery. Without the fake tool, the page shows No writers available with install/sign-in commands and Check again instead of disabled Writer/Effort dropdowns. Project Manual / Automatic controls remain available so automation can be disabled without an available model. Install the fixture tool and choose Check again: available model controls return. Open default settings, choose Sonnet and medium effort, save and reload. Read `/api/walkthrough-settings` independently. Capture the settings page with its note.

Open the project menu and capture it, then open Walkthrough settings. The first option says Use the default and shows the current provider/model/effort. Save Automatic without overriding the writer; `/api/inventory` must contain mode automatic with no writer override. Change the global default, reopen the project dialog, and confirm its default option follows the new value. Select Opus 5.5 and a supported effort as an override, save and reopen; the explicit override remains. Return to Use the default and Manual. Capture the dialog. Model choices include only installed signed-in providers; Codex uses CODEX_HOME model metadata and its per-model effort list. A saved model that disappears remains visibly unavailable and is never silently substituted.

## Gotchas

The fake coding tool authenticates locally and drafts commits; it does not write a real walkthrough. Writer process flags, two-pass effort and unavailable-model failures are covered by the named adapter and server tests. This loopback journey does not establish native mobile/desktop or remote connectivity. Mobile consumes the shared client API; its views are owned separately.

A project whose saved model is missing shows the unavailable warning. Changing Automatic to Manual leaves Save enabled when provider, model and effort are unchanged. Save and independently read inventory to confirm Manual with the same override.

With an unavailable project override and another available writer, the empty Walkthrough's Project walkthrough settings action opens that project's dialog on its own computer. Choose Use the default, save and independently read inventory: the override is absent, the effective available writer is shown and Write walkthrough is enabled. An unavailable global default instead links to Changes & Git.

Save a high-effort Codex choice against a fixture catalog that offers high and medium, then remove high from the catalog. Read `GET /api/walkthrough-settings?projectId=<projectId>&refresh=true` and confirm `unsupported-effort`; the query without a project ID reports the server default. Write walkthrough, Update walkthrough and Try again are hidden when the server reports the unsupported effort; the writer row shows the reason and the same settings action in one line. Hold the catalog request on a ready or failed Walkthrough and confirm Update walkthrough or Try again remains available. Refuse that request and confirm the action remains available with a visible reason and Check again. Restore the request and use that action to retry immediately. In the project settings dialog, the same reason appears beside Effort and Save is disabled. Select medium, save and independently confirm `ready` and the updated effort. Attempt to save high again through both settings endpoints and check for HTTP 422.

The default writer uses the same outlined setting row as Spec files and Pull strategy, with its description beside the controls. The shared-computer notice names Changes & Git.

When a writer is missing or the run reports that it was signed out, use Check again on Review after signing in. A check from the settings dialog also refreshes Review behind it. To test a stale form, remove the selected effort from the fixture after opening settings, then Save. Expect HTTP 422 and confirm the refreshed Effort menu omits the rejected choice.
