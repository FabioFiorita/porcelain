# Canvas

Canvas is Porcelain's authored thinking surface. Use `porcelain_canvas` for every operation; there
is no separate Decision, Review, or promotion entry point.

## Decision flow

Create one Decision Canvas when a material choice appears. Keep its returned `id`, update that same
Canvas as evidence changes, and add `decision` only after the human chooses. Porcelain owns theme,
responsive layout, navigation, and comparison presentation; the payload contains meaning, never
HTML or CSS.

```jsonc
{
  "op": "create",
  "workspace": "/abs/path/to/checkout",
  "template": "decision",
  "templateData": {
    "title": "Choose the Canvas document model",
    "summary": "Select the authoring contract for decision-oriented Canvases.",
    "context": "Agents provide meaning while Porcelain owns presentation.",
    "references": [
      {
        "path": "packages/contracts/src/projects/structured-canvas.contract.ts",
        "line": 1
      }
    ],
    "options": [
      {
        "id": "semantic",
        "name": "Semantic contract",
        "summary": "Agents provide meaning and Porcelain renders it.",
        "pros": ["Responsive and theme-aware by default"],
        "cons": ["Clients must implement the shared contract"],
        "risks": [
          {
            "summary": "Client rendering drifts",
            "severity": "medium",
            "mitigation": "Consume the shared contract"
          }
        ],
        "effort": "Medium",
        "references": [
          { "path": "apps/web/src/features/projects/decision-canvas-view.tsx" }
        ]
      },
      {
        "id": "prose",
        "name": "Prose document",
        "summary": "Agents explain the choice without structured comparison."
      }
    ],
    "criteria": [
      {
        "id": "responsive",
        "label": "Responsive layout",
        "description": "Readable at desktop and phone widths."
      }
    ],
    "assessments": [
      {
        "optionId": "semantic",
        "criterionId": "responsive",
        "rating": "strong",
        "note": "The client adapts one meaning."
      },
      {
        "optionId": "prose",
        "criterionId": "responsive",
        "rating": "fair",
        "note": "The structure is implicit."
      }
    ],
    "recommendation": {
      "optionId": "semantic",
      "summary": "Use the semantic contract.",
      "rationale": ["It keeps presentation product-owned."],
      "confidence": "high",
      "assumptions": ["Clients consume the shared contract."],
      "changeConditions": ["A required decision primitive cannot be represented."]
    }
  }
}
```

`options` accepts two to six named options. Ratings are `poor`, `fair`, `good`, or `strong`.
Repository references use repository-relative `path` values and may include a 1-based `line`.
They identify relevant code; Changes remains the owner of diffs, status, staging, reviewed state,
and history.

To record the outcome, repeat the complete create call above with `"op": "update"`, the returned
`"id"`, and this additional field inside `templateData`:

```jsonc
"decision": {
  "optionId": "semantic",
  "summary": "Adopt the semantic contract.",
  "rationale": ["It keeps one authoring and rendering path."],
  "references": [{ "path": "packages/contracts/src/projects/structured-canvas.contract.ts" }]
}
```

## Review flow

Use `template: "review"` with semantic Markdown strings in `templateData.why` and
`templateData.how`, plus repository-relative `files` and regex-based `layers`. Review presentation
is product-owned; authors do not provide HTML or CSS. A Review written while the checkout is dirty
is live-only. Keep its id and update the same Review after committing on a clean checkout until the
MCP confirms `bound to commit <hash> for History`.

## Lifecycle

Private Canvases live in daemon state. `promote` writes the selected Canvas to:

```text
.porcelain/canvases/<canvas-id>/
```

Promotion never stages or commits. The tracked bundle becomes canonical for that checkout: `list`
and `get` read it, updates rewrite it, and `delete` removes it. Keep secrets out of Canvas and only
record evidence that was actually observed.
