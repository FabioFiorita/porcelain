---
selectors:
  - 'Porcelain refuses to start with the debugging switch'
  - 'Porcelain refuses to start with'
tests:
  - apps/desktop/src/rules/launch-refusal.spec.ts
api: []
---

# app.installed-lock

## What it is

The packaged app refuses debugging switches and Node environment variables before taking its single-instance lock or creating a profile. The release build also locks Electron fuses. Disposable development verification proves the launch-refusal rule; assurance of the packaged fuses and signing belongs to release verification.

## How a user reaches it

- nobody does: the lock refuses an attacker's launch, and the owner sees the app start as usual

## Driving it

Run the named launch-refusal unit spec against the packaged/unpackaged input cases:

```sh
pnpm exec vitest run --project @porcelain/desktop apps/desktop/src/rules/launch-refusal.spec.ts
```

Do not launch, build or inspect an installed app through this skill. The launcher stages only an unpackaged Porcelain Dev into instance-owned storage and verifies its identity. Packaged fuse and signing assurance belongs to release verification, outside this disposable workflow.

## What proves it works

- `apps/desktop/src/rules/launch-refusal.spec.ts`: packaged debugging switches and Node variables are refused, while unpackaged development launches are allowed.
- Packaged fuse and signing checks are release verification, not a desktop launcher command.

## Gotchas

- The installed app is off-limits to this skill. Playwright's debugging connection is for the disposable unpackaged app only.
