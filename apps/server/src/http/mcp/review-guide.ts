export const REVIEW_GUIDE = `# Publishing a Porcelain review

Tell the behavior from entry point to outcome. Keep layers short and ordered. Use lanes for the parts the change crosses, such as Web, Route, Use case, and Storage. A changed step points at code this change alters. A context step points at unchanged code the reader needs. Prefer one or two sentences per step.

## Summary

The summary is one complete HTML document, at most 10 MiB. It runs in an opaque sandbox with scripts, forms, popups, and modals. Network resources such as CDN fonts and libraries are allowed. The page cannot reach Porcelain login state or APIs. Link to layers with \`#layer-N\`, where N is the 1-based published order. Porcelain handles that navigation. Do not embed credentials.

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

When the change crosses more than one part of the system, add a summary diagram: lanes, boxes, and arrows. An After view marks boxes New, Changed, or Removed. A Before view is useful when it shows what was wrong. Name the layer behind each box. Add an extra arrow only for a branch or callback the step order does not already show.

## Repair gaps before handing the review off

1. Call \`read_review\` and keep its revision.
2. Publish with \`expectedRevision\` set to that revision. A mismatch means someone published since you read: read again, then publish.
3. Fix every unresolved pointer the response returns as changed. Point the step at a line that exists.
4. Fix lines Porcelain reports as Not explained: either cover them with a changed step or leave them out of the diff you are handing off.
5. Publish the whole review again. Publishing replaces the latest summary, diagram, and layers. Keep anything that should stay.

## Comments

Nothing is pushed to you. When asked to read comments, call \`list_comments\`.

The default, and \`scope: "waiting"\`, returns unresolved threads whose latest message is not from the agent. That is the work waiting on you. A thread you already answered, and a resolved thread, stay out of that list.

\`scope: "all"\` returns every thread, including resolved threads and threads whose latest message is yours.

Reply in Markdown with \`reply_to_comment\`. Resolve a thread only after you fixed it or the reviewer accepted it. Use the optional ids on create and reply so a retry does not add a second copy.
`;
