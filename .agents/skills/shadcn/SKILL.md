---
name: shadcn
description: Compose or customize Porcelain shadcn UI components. Use when changing component behavior, adding primitives, or resolving Base UI integration issues.
user-invocable: false
---

# shadcn UI

Start with the existing components and their callers in `apps/web/src/components/ui`.
Reuse supported variants and semantic theme tokens. Check the project's `components.json`
and installed implementation before choosing Radix or Base UI APIs; they are not interchangeable.

Use judgment on layout and presentation. Existing defaults support consistency, but may be adapted
when the requested design or accessibility needs it. Keep accessible names, keyboard interaction,
focus restoration and responsive behavior intact. Verify changed interactions in the real browser
when appropriate to the task.

For a missing primitive or an unfamiliar API, use the project's package runner to look up the
relevant component documentation. Do not search registries or invoke the CLI for routine edits to
components already in the repository. Confirm generated code fits the installed component base.

Read only the reference that answers the task:

- [Composition](rules/composition.md) and [Base UI versus Radix](rules/base-vs-radix.md): triggers, groups and compound components.
- [Forms](rules/forms.md): field semantics, validation and input groups.
- [Styling](rules/styling.md) and [customization](customization.md): variants and theme customization.
- [CLI](cli.md), [registries](registry.md) and [MCP](mcp.md): component discovery and installation.
- [Icons](rules/icons.md) and [chat](rules/chat.md): specialized component conventions.

These references supply recipes, not additional product requirements. Prefer the user's intended
outcome and the owning component's supported API when a generic recipe does not fit.
