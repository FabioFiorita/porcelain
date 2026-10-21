---
screen: /reviews-git
selectors:
  - 'Reviews & Git'
  - 'When archiving a review'
  - 'Pull strategy'
  - 'pull-merge'
  - 'pull-rebase'
  - 'Commit model'
  - 'Read models again'
tests:
  - packages/client/src/features/preferences/store.spec.ts
  - packages/client/src/features/projects/queries/folders.spec.ts
api:
  - GET /api/git/commit-models
---

# preferences.reviews-git

Settings → Reviews & Git owns the three archive deletion switches. These switches are absent from General. Pull strategy saves Merge/Rebase using the existing shared preference. Commit model reads models from the currently selected workspace's computer, groups choices by provider and saves the existing shared commitModel preference. With no selected computer it asks the user to open a workspace; failed reads offer Read models again; an empty catalogue explains installation/sign-in. Preferences stay local to this app; mobile currently has no Pull or commit-draft action consuming those saved defaults.

1. Open Reviews & Git on phone/tablet. Toggle every archive switch, choose Rebase and an installed model. Read back porcelain-preferences.db and cold-launch to confirm persistence without changing other preferences.
2. Return with native Back on phone or General category on iPad. Archive controls must not appear in General. Reopen Reviews & Git and confirm the same values.
3. Select a workspace on another disposable computer with a different model catalogue. Expect its own models. A saved unavailable model follows shared resolution without silently overwriting the saved preference. Exercise no workspace, failed catalogue/retry and no installed CLIs separately.
4. Exercise an archive preview through projects.workspace-picker and compare deletion choices with the saved switches. Do not claim Pull/commit execution from preference storage alone.

Read/save failures preserve prior preferences, disable controls and offer Read saved preferences again, as preferences.appearance describes. Native proof remains separate for Android, iPhone and iPad.
