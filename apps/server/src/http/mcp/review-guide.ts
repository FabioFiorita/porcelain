import {
  REVIEW_PROOF_ASSETS,
  REVIEW_PROOF_FILE_MEBIBYTES,
  REVIEW_PROOF_MEBIBYTES,
  REVIEW_PROOF_OUTPUT_LENGTH,
} from '@porcelain/contracts/shared';

export const REVIEW_GUIDE = `# Publishing a Porcelain review

The review helps the developer understand how the architecture changes and which decisions future agents will copy. Porcelain shows it as a walkthrough: a briefing of what the change adds to the system, then one stop per layer in the order you publish, then whatever no layer explains. Each layer is one decision: a behavior told from entry point to outcome, or one coherent ownership or architectural decision. Do not make Server, Client or Interface separate layers: those are lanes within a decision, and Porcelain shows the lanes a decision crosses as its route. Order layers so a reader meets an owner before the decisions that use it.

The reader marks a decision reviewed, and that marks every file it shows. Each changed file appears in full, once, in the first layer whose changed step points at it, so point the layer that introduces a shared owner at that owner's file. A changed step points at code this change alters; its text appears as a numbered note under the last line it points at, so end the step where the explained block ends. A context step points at unchanged code the reader needs and appears as an excerpt after the decision's code. Write step text as one or two sentences on the decision and its consequence, not a narration of the code. Keep the layer summary to two or three sentences; longer text is folded. Changed lines no step covers are listed as Not explained, both as files of their own and as marked lines inside explained files.

## Summary

The summary is the Agent summary tab beside the walkthrough. It is one complete HTML document, at most 10 MiB. It runs in an opaque sandbox with scripts, forms, popups, and modals. Network resources such as CDN fonts and libraries are allowed. The page cannot reach Porcelain login state or APIs. Link to layers with \`#layer-N\`, where N is the 1-based published order. Porcelain handles that navigation. Do not embed credentials.

You own the design and must include CSS. Inspect the reviewed application's styles, theme tokens, and components first. Match its colors, background, typography, and visual language where it has them. If it has none, choose a coherent readable design. Style the layer navigation as well as the content: clear headings, spacing, and a content width that works in a narrow pane. Do not rely on browser-default links, and do not add an empty token rule only to silence the warning.

Porcelain displays the HTML as authored. \`--porcelain-background\`, \`--porcelain-foreground\`, and \`data-theme\` (\`light\` or \`dark\`) are available when you want the page to follow Porcelain's theme. They are not a required palette. Preview the summary, check contrast, navigation, and overflow, and say so if you could not look at it. Publishing without detectable CSS returns an advisory warning. The warning does not reject the review, and CSS being present does not certify that the page looks right.

A compact page that matches a light application:

\`\`\`html
<!doctype html>
<html data-theme="light">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light dark;
        --ink: var(--porcelain-foreground, #1c1917);
        --paper: var(--porcelain-background, #fafaf9);
        --rule: color-mix(in srgb, var(--ink) 16%, transparent);
      }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font: 16px/1.5 ui-sans-serif, system-ui, sans-serif;
      }
      main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
      nav a { color: inherit; margin-right: 0.75rem; }
      h1 { font-size: 1.5rem; line-height: 1.2; }
    </style>
  </head>
  <body>
    <main>
      <nav><a href="#layer-1">Save a file</a></nav>
      <h1>Saving writes the bytes, then tells the review</h1>
      <p>Verified with the file-save spec. The new path rejects an empty name.</p>
    </main>
  </body>
</html>
\`\`\`

## Diagram

When the change crosses more than one part of the system, add a diagram: lanes, boxes, and explicit arrows. Porcelain does not draw it as a graph. It reads it as the briefing "What this adds to the system" and as each decision's connections, so write it for those:

- Mark each owner the work adds, alters or removes with New, Changed or Removed in the After view, with a one-line \`detail\`. A box whose label is a layer's title stands for that decision and is not listed as an owner.
- Name the layer behind each box with \`layerId\` so the reader can jump from an owner to its code.
- Use \`problem\` for a decision the developer must make: two writes without a shared transaction, a second copy of an owner that already exists, a pattern this change follows differently from the rest of the codebase. Each problem is shown as "Needs your decision" in the briefing and in every decision connected to that box.
- Label every arrow with its meaning, such as calls, reads, writes, publishes or depends on. An arrow from a decision's box to an owner appears on that decision as "uses Delivery outbox". Describe all actual relationships, including ordinary calls; step order never creates an arrow.
- A Before view is optional context for ownership that moved.

These are your architectural claims, not automatically verified call traces. Support them with code pointers in the linked layer, and leave uncertain relationships in the detail instead of drawing a confident arrow.

## Proof

Attach proof that the work is done in \`proof\`. Porcelain shows it beside the review, and a failing check stands out. Report what you actually ran; never mark a check you did not run as passing.

- \`checks\`: one entry per check you ran, with \`name\`, \`result\` (\`pass\`, \`fail\` or \`skipped\`) and an optional short \`output\` of at most ${REVIEW_PROOF_OUTPUT_LENGTH} characters, such as the failing assertion or the summary line. Publish a failing check as \`fail\` rather than leaving it out.
- \`assets\`: at most ${REVIEW_PROOF_ASSETS}. An \`image\` (PNG, JPEG, GIF or WebP) or a \`video\` (MP4 or WebM) names a \`path\` relative to the worktree root. Porcelain reads the file when you publish and keeps its own copy: at most ${REVIEW_PROOF_FILE_MEBIBYTES} MiB per file and ${REVIEW_PROOF_MEBIBYTES} MiB together. Its content must match its kind; an SVG or any other document is refused. Save a screenshot inside the worktree, publish, then delete the file so it does not show up as an unexplained change; Porcelain keeps its copy. A \`link\` names an \`http\` or \`https\` \`url\`, such as a CI run.
- Every check and asset has a \`title\` or \`name\`, and may name the \`layerId\`, or the \`layerId\` and \`stepId\`, it proves. Without them it belongs to the whole review.

\`\`\`json
{
  "proof": {
    "checks": [
      { "name": "pnpm test", "result": "pass" },
      { "name": "Save journey", "result": "fail", "output": "Expected the Saved notice", "layerId": "<layer id>" }
    ],
    "assets": [
      { "kind": "image", "title": "Saved notice", "path": "tmp/saved.png", "layerId": "<layer id>" }
    ]
  }
}
\`\`\`

Proof describes the changes as they were when you published it. Once they change, Porcelain shows the checks as out of date until you run them and publish again; your own proof files coming or going do not count. Publishing replaces the proof with the one you send. When you republish, send every check again, and every asset you want to keep: a new file by \`path\`, and an image or video already published by \`proofId\`, its \`id\` from \`read_review\`, in place of \`path\`. Porcelain reuses its copy, so the file does not need to exist any more. Name either \`path\` or \`proofId\`, never both.

## Repair gaps before handing the review off

1. Call \`read_review\` and keep its revision.
2. Publish with \`expectedRevision\` set to that revision. A mismatch means someone published since you read: read again, then publish.
3. Fix every unresolved pointer the response returns as changed. Point the step at a line that exists.
4. Fix lines Porcelain reports as Not explained: either cover them with a changed step or leave them out of the diff you are handing off.
5. Publish the whole review again. Publishing replaces the latest summary, diagram, layers, and proof. Keep anything that should stay; keep published images and videos by their \`proofId\`.

## Comments

Nothing is pushed to you. When asked to read comments, call \`list_comments\`.

The tool result includes a \`threads\` array. The default, and \`scope: "waiting"\`, returns unresolved threads whose latest message is not from the agent. That is the work waiting on you. A thread you already answered, and a resolved thread, stay out of that list.

\`scope: "all"\` returns every thread, including resolved threads and threads whose latest message is yours.

A thread's \`anchor.comparison\` names what the reviewer was reading. \`worktree\` is the uncommitted changes, staged, unstaged or untracked. \`commit\` is one commit against a parent, and \`revision\` is that commit. \`branch\` is the whole branch since it forked from \`base\`, like a pull request, and \`revision\` is the branch tip the reviewer read: \`additions\` lines are lines of the file at that tip and \`deletions\` lines are lines at the merge base. If you committed since, find the code again before you change it.

Reply in Markdown with \`reply_to_comment\`. Resolve a thread only after you fixed it or the reviewer accepted it. Use the optional ids on create and reply so a retry does not add a second copy.
`;
