# Project hide/pin state

Hide and pin preferences are private daemon-root Project data. The app's Files surface reads and
writes the current project-relative channel; it is not a repository Review lifecycle. Agents should use the app surface when the human asks to hide or pin paths.

When a team needs the same defaults in a checkout, use the explicit
`porcelain_profile` with `op: "promote"` and `level: "project"`. It writes `.porcelain/project.json` and never stages or
commits the result:

```jsonc
porcelain_profile { "op": "promote", "workspace": "/abs/path/to/checkout", "level": "project" }
```

The tracked overlay contains only repository-relative hidden and pinned paths. Private daemon
state remains private until that explicit promotion.
