---
screen: /settings
selectors:
  - 'Settings'
  - 'Environments'
  - 'Appearance'
  - 'Theme, code and documents'
  - 'add-environment'
  - 'cancel-pairing'
  - 'No environments paired.'
  - 'Add environment'
  - 'Reading saved environments…'
  - 'Read saved environments again'
  - 'settings-appearance'
  - 'settings-environments'
  - 'settings-development'
  - 'Check connection'
  - 'Forget environment'
tests: []
api:
  - GET /api/environment
  - GET /api/session
---

# access.settings

## What it is

On its first iPad visit, Settings has Appearance already visible beside a category pane containing Appearance, Environments and, in development builds, Development. Selecting a category replaces the detail without another navigation step. The app sidebar keeps its current state; its glass control sits in the native Settings toolbar, as on the workspace. In a narrow iPad window, the categories sit above the detail. One native toolbar is titled Settings above both category and content panes; the bounded category pane has a full-height divider and no duplicated category heading in the detail. Returning to Settings retains the selected category. In Environments, its native Add environment button opens the pairing form inline; Cancel closes it without changing the environment list. Development shows the component selector and selected preview directly.

On iPhone and Android, Settings groups Appearance and Environments in a bounded, scrollable content column below its native header. The Appearance item opens a native stack destination for this app's theme, code and document defaults. Development builds group the Component library item under Development. Each paired environment shows its status. Add environment sits beside the Environments heading and wraps below it when needed; it is disabled until saved environments are ready. With none paired, a card says “No environments paired.” and explains how to connect with a pairing link. While reading saved environments it says “Reading saved environments…”, and when they cannot be read it offers “Read saved environments again”.

## How a user reaches it

- phone: the Settings tab; iPad: Settings in the sidebar
- the deep link `porcelain.dev://settings`

## Driving it

1. Select the Settings tab or sidebar row, or open porcelain.dev://settings. On the first iPad visit, expect Settings categories and Appearance controls immediately; subsequent visits retain the category. Confirm the app sidebar did not change state, then select Environments. On iPhone and Android, expect the overview. Expect the card's paired environment marked Online and Add environment.
2. On iPad select Appearance; on a phone select Theme, code and documents under Appearance. Follow preferences.appearance, then return to Environments on iPad or through native Back on a phone. Expect the same environments and Add environment.
3. Select Add environment. On iPad expect an inline pairing card in Environments; on a phone expect the pairing sheet. Select Cancel and expect the same environment state. On a phone also reopen and dismiss the sheet; expect the same result.
4. Expect each environment to show its status and visible Check connection (refresh) and Forget environment (trash) buttons. Follow access.environment-status for checking and access.forget-environment for the only paired fixture. Expect No environments paired, the pairing-link guidance and Add environment.
5. On iPad, show the app sidebar and return to the worktree and its Review, Files and History inspector modes; on a phone use the tabs. Reopen Settings and expect the same environment state. On iPad, the Settings content stays in a readable column and does not draw underneath the sidebar; in a narrow window its categories sit above the detail. On a phone, the section action and text fit or wrap without clipping.
6. Reading saved environments… is transient. Read saved environments again requires a storage-error fixture; do not claim it from normal startup.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- The unreadable-storage state needs a broken Keychain entry; no test reaches it yet.
- Each environment row reads `GET /api/environment` and authenticated `GET /api/session` from its own server to show its status; `access.environment-status` covers the statuses.
