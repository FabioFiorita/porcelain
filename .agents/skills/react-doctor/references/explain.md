# Explaining and configuring rules

Use the installed version to inspect the actual finding:

```sh
pnpm exec react-doctor rules explain <rule>
```

Read the affected code before deciding whether the rule applies. Use the explanation's
linked documentation when more detail is needed; there is no mandatory remote playbook.

When a configuration change is warranted, inspect `pnpm exec react-doctor rules --help`
and the existing `doctor.config.*`. Change the narrowest setting that matches the intent:
rule severity for one rule, a category for a whole concern, or report visibility when the
rule should still run. Preserve unrelated settings. An intentional exception should explain
why it is appropriate; do not turn one false positive into a blanket exclusion.

Rescan the affected scope to verify the result, checking that analysis completed.
