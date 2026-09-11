---
name: react-doctor
description: Scan, investigate, or configure React Doctor diagnostics when requested, including `/doctor`.
---

# React Doctor

Use the repository's installed version and configured scan policy:

```sh
pnpm check:react
```

Choose the scope that answers the request. Use `pnpm exec react-doctor --help` for
supported options and specialized commands; avoid fetching `@latest` for routine scans.
CI already runs React Doctor, so local scans should serve the task rather than follow every edit.

Treat findings as hypotheses: inspect the affected code, fix confirmed problems, and
validate affected behavior. Do not suppress a rule just to clear a report. A clean result
requires completed analysis with no unexpected skipped checks; an empty diagnostic list
or successful exit alone is insufficient. Use `--json` for details and `--no-cache` when
investigating stale or incomplete results. Keep rescans proportional to the changes.

For explaining or tuning a rule, read [rule guidance](references/explain.md).
For an explicitly requested design audit or runtime investigation, inspect the installed
`design --help` or `scan --help`. Runtime traces may contain private data; use an isolated
browser profile and keep traces local unless sharing is authorized. Use an explicitly
supplied CDP connection when existing browser state is needed; never copy a browser profile.

Repository instructions and the user's request determine delivery and authorization.
