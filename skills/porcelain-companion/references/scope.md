# Project hide/pin state

Hide and pin preferences are private daemon-root Project data. The app's Files surface reads and
writes the current project-relative channel; it is not a repository Review lifecycle or a CLI
`scope` command. Agents should use the app surface when the human asks to hide or pin paths.

When a team needs the same defaults in a checkout, use the explicit
`project promote-overrides` command. It writes `.porcelain/project.json` and never stages or
commits the result:

```bash
~/.porcelain/porcelain project promote-overrides
```

The tracked overlay contains only repository-relative hidden and pinned paths. Private daemon
state remains private until that explicit promotion.
